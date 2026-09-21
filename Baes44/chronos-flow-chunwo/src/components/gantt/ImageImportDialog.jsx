import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Upload, FileSpreadsheet, Download, CheckCircle, Loader2 } from "lucide-react";
import { parseXER, parseXerTables } from "@/lib/parseXER";
import { decodeTasksFromPDFInfo } from "@/lib/ganttPDFData";
import * as XLSX from "xlsx";
import { Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// ── Date parsing helpers ────────────────────────────────────
function parseDate(value) {
  if (!value) return "";
  const cleaned = String(value).trim();
  const num = Number(cleaned);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    return date.toISOString().slice(0, 10);
  }
  const m1 = cleaned.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2,'0')}-${m1[3].padStart(2,'0')}`;
  const m2 = cleaned.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m2) return `${m2[3]}-${m2[1].padStart(2,'0')}-${m2[2].padStart(2,'0')}`;
  const d = new Date(cleaned);
  if (!isNaN(d.getTime()) && cleaned.length >= 6) return d.toISOString().slice(0, 10);
  return "";
}

function parseDateWithActual(value) {
  if (!value) return { date: "", actual: false };
  const cleaned = String(value).trim();
  const actualMatch = cleaned.match(/^(.+?)\s*[Aa]$/);
  const dateStr = actualMatch ? actualMatch[1].trim() : cleaned;
  const parsed = parseDate(dateStr);
  return { date: parsed, actual: !!actualMatch && !!parsed };
}

// ── Chronology CSV parser ─────────────────────────────────────────────────
// Detects: has "Date" + "Summary" columns (Chronology table format)
// Maps: Date → start & end, Doc. Ref → activityId, Summary → activity
function isChronologySheet(headers) {
  const h = headers.map(s => s.toLowerCase().trim());
  return h.some(h => h === "date") && h.some(h => h === "summary");
}

function parseChronologySheet(rows, headerRow, headers) {
  const h = headers.map(s => s.toLowerCase().trim());
  const dateCol   = h.findIndex(c => c === "date");
  const summaryCol = h.findIndex(c => c === "summary");
  const refCol    = h.findIndex(c => /doc\.?\s*ref|reference/i.test(c));
  const typeCol   = h.findIndex(c => /document\s*type|doc.*type/i.test(c));
  const categoryCol = h.findIndex(c => /delaying.*event|category/i.test(c));
  const noCol     = h.findIndex(c => c === "no" || c === "no." || c === "#");

  const tasks = [];

  // Group by Delaying Event Category → use as section header when category changes
  let lastCategory = null;

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.some(c => String(c || "").trim() !== "")) continue;

    const dateRaw   = dateCol >= 0 ? String(row[dateCol] || "").trim() : "";
    const summary   = summaryCol >= 0 ? String(row[summaryCol] || "").trim() : "";
    const docRef    = refCol >= 0 ? String(row[refCol] || "").trim() : "";
    const docType   = typeCol >= 0 ? String(row[typeCol] || "").trim() : "";
    const category  = categoryCol >= 0 ? String(row[categoryCol] || "").trim() : "";
    const noRaw     = noCol >= 0 ? String(row[noCol] || "").trim() : "";

    if (!dateRaw && !summary) continue;

    // Insert section header when Delaying Event Category changes
    if (category && category !== lastCategory) {
      tasks.push({ isSection: true, sectionType: "blue", activity: category });
      lastCategory = category;
    }

    const parsedDate = parseDate(dateRaw);
    const activityText = summary || "(No Summary)";

    tasks.push({
      isSection: false,
      activityId: docRef || noRaw,
      activity: activityText,
      start: parsedDate,
      end: "",           // Chronology: single date → Start Milestone (no end)
      barType: "baseline",
      item: docType || undefined,
    });
  }
  return tasks;
}

// ── P6 Activities Excel parser ────────────────────────────────
// Supports two formats:
//   A) Row 0 = internal col names (task_code/wbs_id/task_name), Row 1 = human labels, Row 2+ = data
//   B) Row 0 = human labels ("Activity ID"/"WBS Code"/"Activity Name"), Row 1+ = data  ← our P6 Excel export
function isP6ActivitiesSheet(rows) {
  if (rows.length < 2) return false;
  const row0 = rows[0].map(c => String(c || "").toLowerCase().trim());
  // Format A: internal field names
  if (row0.includes("task_code") && row0.includes("wbs_id") && row0.includes("task_name")) return true;
  // Format B: human-readable header row (our export format)
  if (row0.includes("activity id") && row0.includes("wbs code") && row0.includes("activity name")) return true;
  return false;
}

// Fast date extraction for P6 datetime strings like "2024-01-12 08:00:00"
function extractP6Date(val) {
  if (!val) return "";
  const s = String(val);
  // YYYY-MM-DD at start (handles both date-only and datetime)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : parseDate(s);
}

function parseP6ActivitiesSheet(rows) {
  const row0 = rows[0].map(c => String(c || "").toLowerCase().trim());

  // Detect format: internal names (task_code) vs human labels (activity id)
  const isInternalNames = row0.includes("task_code");

  // Map columns by matching either internal or human-readable names
  function findCol(internalName, humanPattern) {
    const byInternal = row0.indexOf(internalName);
    if (byInternal >= 0) return byInternal;
    return row0.findIndex(h => humanPattern.test(h));
  }

  const taskCodeCol  = findCol("task_code",          /^activity\s*id$/);
  const wbsCol       = findCol("wbs_id",             /^wbs\s*code$/);
  const nameCol      = findCol("task_name",           /^activity\s*name$/);
  const startCol     = findCol("start_date",          /^\(\*\)start$|^start$/);
  const endCol       = findCol("end_date",            /^\(\*\)finish$|^finish$|^end$/);
  const deleteCol    = findCol("delete_record_flag",  /^delete/);
  const remDurCol    = findCol("remain_drtn_hr_cnt",  /rem.*dur|remaining.*dur/);
  const floatCol     = findCol("total_float_hr_cnt",  /^float$|total\s*float|^tf$/);
  const pctCol       = findCol("phys_complete_pct",   /^%.*comp|activity.*%|schedule.*%|complete.*%/);
  const blStartCol   = findCol("bl_start_date",       /bl.*start|baseline.*start|planned.*start/);
  const blEndCol     = findCol("bl_end_date",         /bl.*finish|bl.*end|baseline.*finish|planned.*finish/);
  // ── Additional P6 columns ─────────────────────────────────────────────
  const earlyStartCol = findCol("early_start_date",   /early\s*start/);
  const earlyEndCol   = findCol("early_end_date",     /early\s*finish|^early\s*end/);
  const lateStartCol  = findCol("late_start_date",    /late\s*start/);
  const lateEndCol    = findCol("late_end_date",      /late\s*finish|^late\s*end/);
  const freeFloatCol  = findCol("free_float_hr_cnt",  /free\s*float/);
  const expEndCol     = findCol("expect_end_date",    /expected\s*finish/);
  const rsrcCol       = findCol("rsrc_id",            /primary\s*resource|^resource/);
  const durTypeCol    = findCol("duration_type",       /duration\s*type/);
  const pctTypeCol    = findCol("complete_pct_type",   /%.*type/);
  const statusCol     = findCol("status_code",         /^status$|activity\s*status/);
  const cstrTypeCol   = findCol("cstr_type",          /primary\s*constraint$/);
  const cstrDateCol   = findCol("cstr_date",          /constraint\s*date|const\.\s*date/);
  const cstrType2Col  = findCol("cstr_type2",         /secondary\s*constraint/);
  const cstrDate2Col  = findCol("cstr_date2",         /sec\.\s*const.*date|const.*2.*date/);
  const susDateCol    = findCol("suspend_date",       /suspend/);
  const resDateCol    = findCol("resume_date",        /resume/);
  const priorCol      = findCol("priority_type",      /leveling\s*priority|priority/);
  const locCol        = findCol("location_id",        /location/);
  const estWtCol      = findCol("est_wt",             /est.*wt/);
  const targetDurCol  = findCol("target_drtn_hr_cnt", /plan.*duration|target.*duration|original.*duration/);
  const actLabCol     = findCol("act_work_qty",       /actual.*labor|actual.*work/);
  const actNonlabCol  = findCol("act_equip_qty",      /actual.*nonlabor|actual.*equip/);
  const remLabCol     = findCol("remain_work_qty",    /rem.*labor|rem.*work/);
  const remNonlabCol  = findCol("remain_equip_qty",   /rem.*nonlabor|rem.*equip/);
  const planLabCol    = findCol("target_work_qty",     /plan.*labor|budget.*labor/);
  const planNonlabCol = findCol("target_equip_qty",    /plan.*nonlabor|budget.*nonlabor/);
  const dpFlagCol     = findCol("driving_path_flag",  /longest\s*path|driving\s*path/);
  const p6GuidCol     = findCol("guid",                /^guid$|global\s*unique\s*id/);
  const p6TaskIdCol   = findCol("task_id",             /^p6\s*id$|^unique\s*id$/);

  // Helper: parse hours → days (÷8)
  const hrsToDays = (v) => { if (v == null || v === "") return undefined; const n = parseFloat(String(v).replace(",",".")); return isNaN(n) ? undefined : Math.round(n / 8); };
  const pNum = (v) => { if (v == null || v === "") return undefined; const n = parseFloat(String(v).replace(",",".")); return isNaN(n) ? undefined : n; };
  const pStr = (v) => { if (v == null || v === "") return undefined; const s = String(v).trim(); return s || undefined; };

  if (nameCol < 0) return [];

  // Data starts at row 2 for format A (row 1 = human labels), row 1 for format B
  const dataStart = isInternalNames ? 2 : 1;

  const tasks = [];
  let lastWbsSection = null;

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const name     = row[nameCol] != null ? String(row[nameCol]).trim() : "";
    const taskCode = taskCodeCol >= 0 && row[taskCodeCol] != null ? String(row[taskCodeCol]).trim() : "";
    if (!name && !taskCode) continue;

    // Skip deleted rows
    if (deleteCol >= 0 && row[deleteCol] != null && String(row[deleteCol]).trim() !== "") continue;

    const wbsId = wbsCol >= 0 && row[wbsCol] != null ? String(row[wbsCol]).trim() : "";

    // Use top 2 WBS segments as section key
    const dotIdx = wbsId.indexOf(".", wbsId.indexOf(".") + 1);
    const sectionKey = dotIdx >= 0 ? wbsId.slice(0, dotIdx) : wbsId;

    if (sectionKey && sectionKey !== lastWbsSection) {
      tasks.push({ isSection: true, sectionType: "blue", activity: sectionKey });
      lastWbsSection = sectionKey;
    }

    const start = extractP6Date(startCol >= 0 ? row[startCol] : null);
    const end   = extractP6Date(endCol   >= 0 ? row[endCol]   : null);
    const blStart  = blStartCol >= 0 ? extractP6Date(row[blStartCol]) : "";
    const blEnd    = blEndCol   >= 0 ? extractP6Date(row[blEndCol])   : "";
    // P6 stores durations in hours; convert to days (÷8). Float similarly.
    const remDurRaw = remDurCol >= 0 && row[remDurCol] != null ? parseFloat(row[remDurCol]) : null;
    const floatRaw  = floatCol  >= 0 && row[floatCol]  != null ? parseFloat(row[floatCol])  : null;
    const pctRaw    = pctCol    >= 0 && row[pctCol]    != null ? parseFloat(row[pctCol])    : null;
    const remDur = remDurRaw != null && !isNaN(remDurRaw) ? Math.round(remDurRaw / 8) : undefined;
    const float  = floatRaw  != null && !isNaN(floatRaw)  ? Math.round(floatRaw  / 8) : undefined;
    const pct    = pctRaw    != null && !isNaN(pctRaw)    ? Math.round(pctRaw)        : undefined;

    tasks.push({
      isSection: false,
      activityId: taskCode,
      activity: name,
      start,
      end,
      barType: "baseline",
      ...(blStart ? { baselineStart: blStart } : {}),
      ...(blEnd   ? { baselineFinish: blEnd }   : {}),
      ...(remDur != null ? { remainDur: remDur } : {}),
      ...(float  != null ? { float }             : {}),
      ...(pct    != null ? { pct }               : {}),
      // ── Additional P6 fields ───────────────────────────────────────
      ...(earlyStartCol >= 0 ? { earlyStart: extractP6Date(row[earlyStartCol]) || undefined } : {}),
      ...(earlyEndCol   >= 0 ? { earlyEnd:   extractP6Date(row[earlyEndCol])   || undefined } : {}),
      ...(lateStartCol  >= 0 ? { lateStart:  extractP6Date(row[lateStartCol])  || undefined } : {}),
      ...(lateEndCol    >= 0 ? { lateEnd:    extractP6Date(row[lateEndCol])    || undefined } : {}),
      ...(freeFloatCol  >= 0 ? { freeFloat:  hrsToDays(row[freeFloatCol]) }                 : {}),
      ...(expEndCol     >= 0 ? { expectedFinish: extractP6Date(row[expEndCol]) || undefined }: {}),
      ...(rsrcCol       >= 0 ? { primaryResource: pStr(row[rsrcCol]) }                      : {}),
      ...(durTypeCol    >= 0 ? { durationType:    pStr(row[durTypeCol]) }                    : {}),
      ...(pctTypeCol    >= 0 ? { completePctType: pStr(row[pctTypeCol]) }                    : {}),
      ...(statusCol     >= 0 ? { statusCode:      pStr(row[statusCol]) }                     : {}),
      ...(cstrTypeCol   >= 0 ? { constraintType:  pStr(row[cstrTypeCol]) }                   : {}),
      ...(cstrDateCol   >= 0 ? { constraintDate:  extractP6Date(row[cstrDateCol]) || undefined }: {}),
      ...(cstrType2Col  >= 0 ? { constraintType2: pStr(row[cstrType2Col]) }                   : {}),
      ...(cstrDate2Col  >= 0 ? { constraintDate2: extractP6Date(row[cstrDate2Col]) || undefined }: {}),
      ...(susDateCol    >= 0 ? { suspendDate:   extractP6Date(row[susDateCol])  || undefined }: {}),
      ...(resDateCol    >= 0 ? { resumeDate:    extractP6Date(row[resDateCol])  || undefined }: {}),
      ...(priorCol      >= 0 ? { priorityType:  pStr(row[priorCol]) }                        : {}),
      ...(locCol        >= 0 ? { locationId:    pStr(row[locCol]) }                           : {}),
      ...(estWtCol      >= 0 ? { estWt:         pNum(row[estWtCol]) }                         : {}),
      ...(targetDurCol  >= 0 ? { targetDuration: hrsToDays(row[targetDurCol]) }               : {}),
      ...(actLabCol     >= 0 ? { actLaborUnits:    pNum(row[actLabCol]) }                      : {}),
      ...(actNonlabCol  >= 0 ? { actNonlaborUnits: pNum(row[actNonlabCol]) }                   : {}),
      ...(remLabCol     >= 0 ? { remLaborUnits:    pNum(row[remLabCol]) }                      : {}),
      ...(remNonlabCol  >= 0 ? { remNonlaborUnits: pNum(row[remNonlabCol]) }                   : {}),
      ...(planLabCol    >= 0 ? { planLaborUnits:   pNum(row[planLabCol]) }                     : {}),
      ...(planNonlabCol >= 0 ? { planNonlaborUnits: pNum(row[planNonlabCol]) }                  : {}),
      ...(dpFlagCol     >= 0 ? { drivingPathFlag: pStr(row[dpFlagCol]) }                      : {}),
      ...(p6GuidCol     >= 0 ? { p6Guid:          pStr(row[p6GuidCol]) }                       : {}),
      ...(p6TaskIdCol   >= 0 ? { p6TaskId:        pStr(row[p6TaskIdCol]) }                     : {}),
    });
  }

  return tasks;
}

// ── Excel parser ────────────────────────────────────
// Convert a workbook sheet to a plain text representation for AI analysis
function sheetToTextForAI(workbook, sheetName) {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return "";
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  return rows
    .filter(row => row.some(c => String(c || "").trim() !== ""))
    .slice(0, 200) // limit rows
    .map(row => row.map(c => String(c || "").trim()).join("\t"))
    .join("\n");
}

// ── Duration Change format detector ────────────────────────────────
// Detects: has "Activity ID" + "Activity Name" + "New Duration" columns (duration change format)
function isDurationChangeSheet(rows) {
  if (rows.length < 2) return false;
  const row0 = rows[0].map(c => String(c || "").toLowerCase().trim());
  const hasId = row0.some(h => /activity\s*id|^id$/.test(h));
  const hasName = row0.some(h => /activity\s*name|^name$/.test(h));
  const hasDuration = row0.some(h => /new\s*duration|^duration$/.test(h));
  return hasId && hasName && hasDuration;
}

function parseDurationChangeSheet(rows) {
  const row0 = rows[0].map(c => String(c || "").toLowerCase().trim());
  const idCol = row0.findIndex(h => /activity\s*id|^id$/.test(h));
  const nameCol = row0.findIndex(h => /activity\s*name|^name$/.test(h));
  const durationCol = row0.findIndex(h => /new\s*duration|^duration$/.test(h));
  
  if (idCol < 0 || nameCol < 0 || durationCol < 0) return [];
  
  const changes = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.some(c => String(c || "").trim() !== "")) continue;
    
    const activityIdRaw = String(row[idCol] || "").trim();
    const activityName = String(row[nameCol] || "").trim();
    const durationRaw = String(row[durationCol] || "").trim();
    
    // Skip header rows or non-data rows (e.g., "Change" title)
    if (!activityIdRaw || isNaN(parseInt(activityIdRaw))) {
      continue;
    }
    
    // Parse duration - remove "WD", "d", "days" suffixes
    const durationStr = durationRaw.replace(/[^0-9]/g, "");
    const newDuration = parseInt(durationStr) || 0;
    
    // Only add if we have valid activity ID and duration
    if (activityIdRaw && newDuration > 0) {
      changes.push({ 
        activityId: activityIdRaw, 
        activity: activityName, 
        newDuration,
        originalDurationStr: durationRaw // Keep original for debugging
      });
    }
  }
  return changes;
}

function parseExcelSheet(workbook, sheetName) {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return [];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (rows.length < 2) return [];

  // ── Duration Change format (Activity ID, Activity Name, New Duration) ──
  if (isDurationChangeSheet(rows)) return parseDurationChangeSheet(rows);

  // ── P6 Activities export format (task_code / wbs_id / task_name columns in row 0) ──
  if (isP6ActivitiesSheet(rows)) return parseP6ActivitiesSheet(rows);

  let headerRow = -1, headers = [];
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i].map(c => String(c || "").toLowerCase().trim());
    // Chronology format: has "date" + "summary" columns
    if (row.some(h => h === "date") && row.some(h => h === "summary")) {
      headerRow = i; headers = rows[i].map(c => String(c || "")); break;
    }
    // Broader header detection: date columns + activity/description column
    const hasDateCol = row.some(h => /start|end|finish|begin|complete|開始|結束|完成|工程期|日期/.test(h));
    const hasActCol = row.some(h => /activity|description|task|work|name|工序|工程|項目|活動|內容|事項/.test(h));
    // Also detect if row has "Color" or "Colour" column (our export format)
    const hasColorCol = row.some(h => /^colou?r$/.test(h));
    if ((hasDateCol && hasActCol) || hasColorCol) {
      headerRow = i;
      headers = rows[i].map(c => String(c || "").toLowerCase());
      break;
    }
  }
  if (headerRow < 0) return []; // will trigger AI fallback
  // Route to Chronology parser if applicable
  if (isChronologySheet(headers)) return parseChronologySheet(rows, headerRow, headers);
  const colorCol = headers.findIndex(h => /^colou?r$/i.test(h));
  if (colorCol >= 0) return parseColourBasedExcel(rows, headerRow, headers, colorCol);
  // ── Prefixed date columns: Plan/Actual/Baseline/Early/Late + Start/Finish ──
  const hasPrefixedDateCols = headers.some(h => /^(plan|actual|baseline|early|late|bl)\s*(start|finish|end|begin|commence)/i.test(h));
  if (hasPrefixedDateCols) return parseProgressReportSheet(rows, headerRow, headers);
  const startCols = headers.map((h, i) => /start|begin|commence|開始/.test(h) ? i : -1).filter(i => i >= 0);
  const endCols = headers.map((h, i) => /end|finish|complete|結束|完成/.test(h) ? i : -1).filter(i => i >= 0);
  const hasProgrammePrefixes = headers.some(h => /\b(bl|baseline|de|delay|as-planned|actual|early|late)\s+(start|end|finish|begin)/i.test(h));
  if ((startCols.length >= 2 && endCols.length >= 2) || hasProgrammePrefixes) return parseMultiProgrammeExcel(rows, headerRow, headers);
  const hasLateStart = headers.some(h => /late\s*start/.test(h));
  const hasLateFinish = headers.some(h => /late\s*finish/.test(h));
  if (hasLateStart && hasLateFinish) return parseP6Sheet(rows, headerRow, headers);
  const typeCol = headers.findIndex(h => /^type$/i.test(h));
  const idCol = headers.findIndex(h => /^id$|activity.*id|代號|代码|编号|識別碼/.test(h));
  const actCol = headers.findIndex(h => /^activity$|^activity\s+name$|activity.*name|^description$|^name$|^work$|^task$|工序|工程|項目|活動|內容|事項/.test(h));
  const startCol = headers.findIndex(h => /^start|^commence|^begin|^from|^開始/.test(h));
  const endCol = headers.findIndex(h => /^end|^finish|^complete|^結束|^完成/.test(h));
  if (startCol < 0 || endCol < 0) return [];
  const tasks = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row.some(c => String(c).trim() !== "")) continue;
    const typeRaw = typeCol >= 0 ? String(row[typeCol] || "").trim().toUpperCase() : "";
    const activityId = idCol >= 0 ? String(row[idCol] || "").trim() : "";
    const activity = actCol >= 0 ? String(row[actCol] || "").trim() : "";
    const { date: startVal, actual: startActual } = parseDateWithActual(row[startCol] || "");
    const { date: endVal, actual: endActual } = parseDateWithActual(row[endCol] || "");
    const barType = typeRaw === "DE" ? "delay" : "baseline";
    if (!activityId && !activity && !startVal && !endVal) continue;
    if (/^WBS-/i.test(activityId) && !startVal && !endVal) { tasks.push({ isSection: true, sectionType: "blue", activity: activity || activityId }); continue; }
    tasks.push({ activityId: activityId || "", activity: activity || "(Unnamed)", start: startVal, end: endVal, startActual: startActual || undefined, endActual: endActual || undefined, barType, isSection: false });
  }
  const seen = new Set();
  return tasks.filter(task => { const key = JSON.stringify(task); if (seen.has(key)) return false; seen.add(key); return true; });
}

// ── Parse ALL sheets in a workbook, combining tasks from every sheet ──
function parseExcelAllSheets(workbook) {
  if (!workbook || !workbook.SheetNames) return [];
  let allTasks = [];
  for (const sheetName of workbook.SheetNames) {
    const sheetTasks = parseExcelSheet(workbook, sheetName);
    if (sheetTasks && sheetTasks.length > 0) allTasks = allTasks.concat(sheetTasks);
  }
  // De-duplicate identical tasks across sheets
  const seen = new Set();
  return allTasks.filter(task => {
    const key = JSON.stringify(task);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

// ── AI-based Excel fallback ───────────────────────────────────
async function parseExcelWithAI(workbook, sheetName, onProgress) {
  onProgress("Rule-based parsing failed — using AI to analyse Excel structure...");
  const sheetNames = Array.isArray(sheetName) ? sheetName : [sheetName];
  const text = sheetNames.map(s => `=== Sheet: ${s} ===\n` + sheetToTextForAI(workbook, s)).join("\n\n");
  if (!text || text.length < 20) return [];
  const extracted = await base44.integrations.Core.InvokeLLM({
    prompt: `${GANTT_PROMPT_BASE}

The following is tab-separated data extracted from an Excel spreadsheet (sheets: ${sheetNames.join(", ")}).
Analyse the structure carefully: identify which columns represent activity names, IDs, start dates, end dates, and section headers.
Columns may be in Chinese or English, or have non-standard names.
Dates may be in various formats (e.g. DD/MM/YYYY, DD-Mon-YY, YYYY-MM-DD, Excel serial numbers).
Rows without dates but with text that looks like a programme/section title should be is_section=true.

Excel content (tab-separated):
${text.substring(0, 20000)}`,
    response_json_schema: GANTT_TASK_SCHEMA,
  });
  return aiResultToTasks(extracted?.tasks || []);
}

function parseP6Sheet(rows, headerRow, headers) {
  const tasks = [];
  const idCol = headers.findIndex(h => /^p6[\s.]?id$|^activity\s*id$/i.test(h));
  const nameCol = headers.findIndex(h => /^activity\s*name$|^task\s*name$/i.test(h));
  const startCol = headers.findIndex(h => /^start$/i.test(h));
  const finishCol = headers.findIndex(h => /^finish$/i.test(h));
  const lateStartCol = headers.findIndex(h => /^late\s*start$/i.test(h));
  const lateFinishCol = headers.findIndex(h => /^late\s*finish$/i.test(h));
  const floatCol2 = headers.findIndex(h => /^float$|total\s*float|^tf$/i.test(h));
  const remDurCol2 = headers.findIndex(h => /rem.*dur|remaining.*dur/i.test(h));
  const pctCol2 = headers.findIndex(h => /^%.*comp|activity.*%|schedule.*%/i.test(h));
  const blStartCol2 = headers.findIndex(h => /bl.*start|baseline.*start/i.test(h));
  const blEndCol2 = headers.findIndex(h => /bl.*finish|bl.*end|baseline.*finish/i.test(h));
  if ((idCol < 0 && nameCol < 0) || startCol < 0 || finishCol < 0) return [];
  const hasLate = lateStartCol >= 0 && lateFinishCol >= 0;
  const dataRows = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row.some(c => String(c || "").trim() !== "")) continue;
    const idVal = idCol >= 0 ? String(row[idCol] || "").trim() : "";
    const nameVal = nameCol >= 0 ? String(row[nameCol] || "").trim() : "";
    const start = startCol >= 0 ? parseDate(row[startCol]) : "";
    const end = finishCol >= 0 ? parseDate(row[finishCol]) : "";
    const lateStart = hasLate ? parseDate(row[lateStartCol]) : "";
    const lateEnd = hasLate ? parseDate(row[lateFinishCol]) : "";
    if (nameVal && !start && !end && !lateStart && !lateEnd) { dataRows.push({ isSection: true, sectionType: "blue", activity: nameVal }); continue; }
    if (!idVal && !nameVal && !start && !end) continue;
    const floatVal  = floatCol2  >= 0 && row[floatCol2]  != null ? parseFloat(row[floatCol2])  : null;
    const remDurVal = remDurCol2 >= 0 && row[remDurCol2] != null ? parseFloat(row[remDurCol2]) : null;
    const pctVal    = pctCol2    >= 0 && row[pctCol2]    != null ? parseFloat(row[pctCol2])    : null;
    const blS2 = blStartCol2 >= 0 ? parseDate(row[blStartCol2]) : "";
    const blE2 = blEndCol2   >= 0 ? parseDate(row[blEndCol2])   : "";
    dataRows.push({ isSection: false, activityId: idVal, activity: nameVal || "(Unnamed)", start: start || "", end: end || "", lateStart: lateStart || "", lateEnd: lateEnd || "",
      ...(blS2 ? { baselineStart: blS2 } : {}), ...(blE2 ? { baselineFinish: blE2 } : {}),
      ...(floatVal  != null && !isNaN(floatVal)  ? { float: Math.round(floatVal) }    : {}),
      ...(remDurVal != null && !isNaN(remDurVal) ? { remainDur: Math.round(remDurVal) } : {}),
      ...(pctVal    != null && !isNaN(pctVal)    ? { pct: Math.round(pctVal) }         : {}),
    });
  }
  if (dataRows.length === 0) return [];
  if (!hasLate) {
    tasks.push({ isSection: true, sectionType: "blue", activity: "Baseline Programme" });
    dataRows.forEach(r => { if (r.isSection) { tasks.push(r); return; } tasks.push({ activityId: r.activityId, activity: r.activity, start: r.start, end: r.end, barType: "baseline", isSection: false }); });
    return tasks;
  }
  const extra = r => ({ ...(r.baselineStart ? { baselineStart: r.baselineStart } : {}), ...(r.baselineFinish ? { baselineFinish: r.baselineFinish } : {}), ...(r.float != null ? { float: r.float } : {}), ...(r.remainDur != null ? { remainDur: r.remainDur } : {}), ...(r.pct != null ? { pct: r.pct } : {}) });
  tasks.push({ isSection: true, sectionType: "blue", activity: "Early Programme (Start / Finish)" });
  dataRows.forEach(r => { if (r.isSection) { tasks.push(r); return; } if (r.start || r.end) tasks.push({ activityId: r.activityId, activity: r.activity, start: r.start, end: r.end, barType: "baseline", isSection: false, ...extra(r) }); });
  tasks.push({ isSection: true, sectionType: "blue", activity: "Late Programme (Late Start / Late Finish)" });
  dataRows.forEach(r => { if (r.isSection) { tasks.push({ ...r }); return; } if (r.lateStart || r.lateEnd) tasks.push({ activityId: r.activityId, activity: r.activity, start: r.lateStart, end: r.lateEnd, barType: "baseline", isSection: false, ...extra(r) }); });
  return tasks;
}

// ── Shared header → field key mapping for Gantt format round-trip ────────
const EXTRA_FIELD_MAP = [
  // [header regex, field key, type: "date"|"number"|"text"]
  [/^bl\s*start$|^baseline\s*start$|^planned\s*start$/i,       "baselineStart",     "date"],
  [/^bl\s*(finish|end)$|^baseline\s*(finish|end)$|^planned\s*(finish|end)$/i, "baselineFinish", "date"],
  [/^rem\.?\s*dur$|^remaining\s*dur/i,                          "remainDur",         "number"],
  [/^float$|^total\s*float$|^tf$/i,                              "float",             "number"],
  [/^%.*comp$|^activity\s*%.*$|^schedule\s*%.*$|^complete\s*%.*$/i, "pct",           "number"],
  [/^early\s*start$/i,                                          "earlyStart",        "date"],
  [/^early\s*(finish|end)$/i,                                    "earlyEnd",          "date"],
  [/^late\s*start$/i,                                           "lateStart",         "date"],
  [/^late\s*(finish|end)$/i,                                     "lateEnd",           "date"],
  [/^free\s*float$/i,                                           "freeFloat",         "number"],
  [/^exp\.?\s*finish$|^expected\s*finish$/i,                    "expectedFinish",    "date"],
  [/^resource$|^primary\s*resource$/i,                          "primaryResource",   "text"],
  [/^dur\.?\s*type$|^duration\s*type$/i,                        "durationType",      "text"],
  [/^%\s*type$|^complete\s*pct\s*type$/i,                       "completePctType",   "text"],
  [/^status$|^activity\s*status$/i,                             "statusCode",        "text"],
  [/^constraint$|^primary\s*constraint$/i,                      "constraintType",    "text"],
  [/^const\.?\s*date$|^constraint\s*date$/i,                    "constraintDate",    "date"],
  [/^const\.?\s*2$|^constraint\s*2$|^sec\.\s*const/i,          "constraintType2",   "text"],
  [/^const\.?\s*2\s*date$|^constraint\s*2\s*date$/i,            "constraintDate2",   "date"],
  [/^suspend$/i,                                                 "suspendDate",       "date"],
  [/^resume$/i,                                                  "resumeDate",        "date"],
  [/^priority$|^leveling\s*priority$/i,                          "priorityType",      "text"],
  [/^location$/i,                                                "locationId",        "text"],
  [/^est\s*wt$/i,                                                "estWt",             "number"],
  [/^long\.?\s*path$|^driving\s*path$/i,                         "drivingPathFlag",   "text"],
  [/^lock\s*plan$/i,                                             "lockPlanFlag",      "text"],
  [/^auto\s*actuals$/i,                                          "autoComputeActFlag","text"],
  [/^act\.?\s*labor$|^actual\s*labor$/i,                         "actLaborUnits",     "number"],
  [/^act\.?\s*nonlabor$|^actual\s*nonlabor$/i,                   "actNonlaborUnits",  "number"],
  [/^rem\.?\s*labor$/i,                                          "remLaborUnits",     "number"],
  [/^rem\.?\s*nonlabor$/i,                                       "remNonlaborUnits",  "number"],
  [/^plan\s*labor$|^budget\s*labor$/i,                           "planLaborUnits",    "number"],
  [/^plan\s*nonlabor$|^budget\s*nonlabor$/i,                     "planNonlaborUnits", "number"],
  [/^review\s*finish$/i,                                         "reviewFinish",      "date"],
  [/^review\s*status$/i,                                         "reviewStatus",      "text"],
  [/^ext\.?\s*es$/i,                                             "externalEarlyStart","date"],
  [/^ext\.?\s*lf$/i,                                             "externalLateFinish","date"],
  [/^rem\.?\s*es$/i,                                             "remEarlyStart",     "date"],
  [/^rem\.?\s*ef$/i,                                             "remEarlyFinish",    "date"],
  [/^rem\.?\s*ls$/i,                                             "remLateStart",      "date"],
  [/^rem\.?\s*lf$/i,                                             "remLateFinish",     "date"],
  [/^float\s*path$/i,                                            "floatPath",         "text"],
  [/^fp\s*order$/i,                                              "floatPathOrder",    "number"],
  [/^guid$/i,                                                    "p6Guid",            "text"],
  [/^p6\s*id$/i,                                                 "p6TaskId",          "text"],
  [/^plan\.?\s*dur$|^target\s*duration$/i,                       "targetDuration",    "number"],
  [/^calendar$|^working\s*calendar/i,                              "calendar",          "text"],
];

// ── Prefixed date column parser ────────────────────────────────
// Classifies each date column by type (Actual/Plan/Baseline/Early/Late)
// then maps each date to the correct Gantt field.
// Priority for main start/end: Actual > Early > Plan > Baseline
function classifyDateHeader(header) {
  const h = String(header || "").toLowerCase().trim();
  if (!/start|finish|end|begin|commence/.test(h)) return null;

  let type = "planned";
  if (/actual/.test(h)) type = "actual";
  else if (/baseline|^bl\s/.test(h)) type = "baseline";
  else if (/late/.test(h)) type = "late";
  else if (/early/.test(h)) type = "early";
  else if (/plan/.test(h)) type = "planned";

  let position = null;
  if (/start|begin|commence/.test(h)) position = "start";
  else if (/finish|end/.test(h)) position = "finish";

  if (!position) return null;
  return { type, position };
}

function parseProgressReportSheet(rows, headerRow, headers) {
  // Classify every header: build a list of { colIdx, type, position }
  const dateCols = [];
  for (let i = 0; i < headers.length; i++) {
    const cls = classifyDateHeader(headers[i]);
    if (cls) dateCols.push({ colIdx: i, ...cls });
  }
  if (dateCols.length === 0) return [];

  // Find non-date columns
  const hLower = headers.map(s => String(s || "").toLowerCase().trim());
  const noCol = hLower.findIndex(c => /^no\.?$|^#$|^no$|^seq/.test(c));
  const actCol = hLower.findIndex((c, idx) => idx !== noCol && /activity.*name|activity|^name$|description|task|work|工序|工程|項目|活動/.test(c) && !/start|finish|actual|plan|begin|commence|baseline|early|late/.test(c));
  const pctCol = hLower.findIndex(c => /%.*comp|comp.*%|%.*complete/.test(c));

  const pNum = (v) => { if (v == null || v === "") return undefined; const s = String(v).replace("%", "").replace(",", ".").trim(); const n = parseFloat(s); return isNaN(n) ? undefined : n; };

  const tasks = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.some(c => String(c || "").trim() !== "")) continue;

    const noVal    = noCol >= 0 ? String(row[noCol] || "").trim() : "";
    const activity = actCol >= 0 ? String(row[actCol] || "").trim() : "";
    const pct      = pctCol >= 0 ? pNum(row[pctCol]) : undefined;

    // Collect dates by type → { start, finish }
    const datesByType = {};
    dateCols.forEach(dc => {
      const val = parseDate(row[dc.colIdx]);
      if (val) {
        if (!datesByType[dc.type]) datesByType[dc.type] = {};
        datesByType[dc.type][dc.position] = val;
      }
    });

    const actual   = datesByType.actual   || {};
    const early    = datesByType.early    || {};
    const planned  = datesByType.planned  || {};
    const baseline = datesByType.baseline || {};
    const late     = datesByType.late     || {};

    // Main start/end priority: Actual > Early > Planned > Baseline
    const start       = actual.start   || early.start   || planned.start   || baseline.start   || "";
    const end         = actual.finish  || early.finish  || planned.finish  || baseline.finish  || "";
    const startActual = !!actual.start;
    const endActual   = !!actual.finish;

    // Baseline dates: Baseline > Plan
    const baselineStart  = baseline.start  || planned.start  || "";
    const baselineFinish = baseline.finish || planned.finish || "";

    // Late dates
    const lateStart = late.start || "";
    const lateEnd   = late.finish || "";

    if (!activity && !start && !end) continue;

    tasks.push({
      isSection: false,
      activityId: noVal || "",
      activity: activity || "(Unnamed)",
      start,
      end,
      barType: "baseline",
      startActual: startActual || undefined,
      endActual: endActual || undefined,
      ...(baselineStart ? { baselineStart } : {}),
      ...(baselineFinish ? { baselineFinish } : {}),
      ...(lateStart ? { lateStart } : {}),
      ...(lateEnd ? { lateEnd } : {}),
      ...(early.start ? { earlyStart: early.start } : {}),
      ...(early.finish ? { earlyEnd: early.finish } : {}),
      ...(pct != null ? { pct } : {}),
    });
  }
  return tasks;
}

function parseColourBasedExcel(rows, headerRow, headers, colorCol) {
  const tasks = [];
  const typeCol = headers.findIndex(h => /^type$/i.test(h));
  const idCol = headers.findIndex(h => /activity\s*id|^id|代號|代码|^code/.test(h));
  const actCol = headers.findIndex((h, idx) => idx !== idCol && /activity.*name|activity|description|task|name|工序|工程|項目|活動|work/.test(h) && !/^rp07|^tia|start|finish|^col|^id/.test(h));
  const itemCol = headers.findIndex(h => /^item$|^no\.?$|^#$|序號/.test(h));
  const startCol = headers.findIndex(h => /^start|^commence|^begin|^from/.test(h));
  const endCol = headers.findIndex(h => /^end|^finish|^complete/.test(h));
  if (startCol < 0 || endCol < 0) return [];

  // ── Dynamically detect extra columns beyond the core set ──────────
  const extraCols = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    for (const entry of EXTRA_FIELD_MAP) {
      if (entry[0].test(h)) {
        extraCols.push({ colIdx: i, fieldKey: entry[1], type: entry[2] });
        break;
      }
    }
  }

  // Helper: read a cell value for a given extra column
  function readExtra(row, spec) {
    if (spec.colIdx >= row.length) return null;
    const raw = row[spec.colIdx];
    if (raw == null) return null;
    const s = String(raw).trim();
    if (s === "") return null;
    if (spec.type === "date") {
      const d = parseDate(s);
      return d || null;
    }
    if (spec.type === "number") {
      const n = parseFloat(s.replace(",", "."));
      return isNaN(n) ? null : Math.round(n);
    }
    return s || null;
  }

  let currentColour = null, currentGroupName = null;
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row.some(c => String(c).trim() !== "")) continue;
    const colorRaw = String(row[colorCol] || "").trim().toUpperCase();
    const activity = actCol >= 0 ? String(row[actCol] || "").trim() : "";
    if (["A", "B"].includes(colorRaw) && activity) {
      currentColour = colorRaw; currentGroupName = activity;
      tasks.push({ isSection: true, sectionType: colorRaw === "A" ? "blue" : "pink", activity }); continue;
    }
    if (currentColour && currentGroupName) {
      const typeRaw = typeCol >= 0 ? String(row[typeCol] || "").trim().toUpperCase() : "";
      const activityId = idCol >= 0 ? String(row[idCol] || "").trim() : "";
      const itemRaw = itemCol >= 0 ? String(row[itemCol] || "").trim() : "";
      const { date: startVal, actual: startActual } = parseDateWithActual(row[startCol] || "");
      const { date: endVal, actual: endActual } = parseDateWithActual(row[endCol] || "");
      const barType = typeRaw === "DE" ? "delay" : "baseline";
      if (activityId || activity || startVal || endVal) {
        const extra = {};
        extraCols.forEach(spec => {
          const v = readExtra(row, spec);
          if (v !== null) extra[spec.fieldKey] = v;
        });
        tasks.push({
          item: itemRaw || undefined,
          activityId: activityId || "",
          activity: activity || "(Unnamed)",
          start: startVal || "", end: endVal || "",
          startActual: startActual || undefined, endActual: endActual || undefined,
          barType, isSection: false,
          ...extra,
        });
      }
    }
  }
  return tasks;
}

function parseMultiProgrammeExcel(rows, headerRow, headers) {
  const tasks = [];
  const idCol = headers.findIndex(h => /activity\s*id|^id|代號|代码|^code/.test(h));
  const actCol = headers.findIndex((h, idx) => idx !== idCol && /activity.*name|activity|description|task|name|工序|工程|項目|活動|work/.test(h) && !/^rp07|^tia|start|finish|^col|^id/.test(h));
  const datePairs = []; const processed = new Set();
  for (let i = 0; i < headers.length; i++) {
    if (processed.has(i)) continue;
    const hdr = headers[i];
    if (/\s*(start|begin|commence)/.test(hdr)) {
      let prefix = hdr.replace(/\s*(start|begin|commence).*$/i, "").trim();
      const normalizePrefix = (p) => { if (!p) return ""; const u = p.toUpperCase(); if (u==="BL"||u.includes("BASELINE")||u.includes("AS-PLANNED")||u.includes("EARLY")) return "BASELINE"; if (u==="DE"||u.includes("DELAY")||u.includes("ACTUAL")||u.includes("LATE")) return "DELAY"; return u; };
      const normalizedPrefix = normalizePrefix(prefix);
      const endIdx = headers.findIndex((h, idx) => { if (idx <= i || processed.has(idx)) return false; if (!/end|finish|complete/.test(h)) return false; const hPrefix = normalizePrefix(h.replace(/\s*(end|finish|complete).*$/i, "").trim()); return normalizedPrefix === hPrefix; });
      if (endIdx >= 0) { datePairs.push({ prefix: prefix || `Programme ${datePairs.length+1}`, startCol: i, endCol: endIdx, normalizedPrefix }); processed.add(i); processed.add(endIdx); }
    }
  }
  datePairs.forEach(pair => {
    tasks.push({ isSection: true, sectionType: "blue", activity: pair.prefix });
    const isDelay = pair.normalizedPrefix && pair.normalizedPrefix.includes("DELAY");
    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row.some(c => String(c).trim() !== "")) continue;
      const activityId = idCol >= 0 ? String(row[idCol] || "").trim() : "";
      const activity = actCol >= 0 ? String(row[actCol] || "").trim() : "";
      const start = parseDate(row[pair.startCol]); const end = parseDate(row[pair.endCol]);
      if ((activityId || activity) && (start || end)) tasks.push({ activityId: activityId || "", activity: activity || "(Unnamed)", start: start || "", end: end || "", barType: isDelay ? "delay" : "baseline", isSection: false });
    }
  });
  const seen = new Set();
  return tasks.filter(task => { const key = JSON.stringify(task); if (seen.has(key)) return false; seen.add(key); return true; });
}

// ── P6 XML parser ────────────────────────────────────────────────────────────
// Supports the Primavera P6 PMXML export format (*.xml)
function parseP6XML(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");

  // Check for parse errors
  if (doc.querySelector("parsererror")) return null;

  // Helper: get text content of first child element with tag
  const getText = (el, tag) => el?.querySelector(tag)?.textContent?.trim() || "";

  // Normalise a P6 datetime string → YYYY-MM-DD
  const normaliseDate = (s) => {
    if (!s) return "";
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : parseDate(s);
  };

  const tasks = [];

  // ── Approach 1: PMXML format (<Project> → <WBS> + <Activity>) ────────────
  const projects = Array.from(doc.querySelectorAll("Project"));
  if (projects.length > 0) {
    for (const proj of projects) {
      // Build WBS id → name map
      const wbsMap = {};
      for (const w of proj.querySelectorAll("WBS")) {
        const id   = getText(w, "ObjectId") || w.getAttribute("ObjectId") || "";
        const code = getText(w, "Code") || getText(w, "Name") || id;
        const name = getText(w, "Name") || code;
        wbsMap[id] = { code, name, parentId: getText(w, "ParentObjectId") };
      }

      // Get WBS name by id (use Name, fallback to Code)
      const getWbsName = (id) => wbsMap[id]?.name || id;

      // Build objectId → activityId map for relationship resolution
      const objIdToActId = {};
      for (const act of proj.querySelectorAll("Activity")) {
        const objId = getText(act, "ObjectId");
        const actId = getText(act, "Id") || getText(act, "ActivityId") || objId;
        if (objId) objIdToActId[objId] = actId;
      }

      // Parse relationships: predecessor ObjectId → { succActId, type, lagDays }
      // P6 stores Lag in hours; convert to days (÷8 for 8h/day calendar)
      const HOURS_PER_DAY = 8;
      const relsByPredObjId = {}; // predObjId → first relationship (FS only for now)
      for (const rel of proj.querySelectorAll("Relationship")) {
        const predObjId = getText(rel, "PredecessorActivityObjectId");
        const succObjId = getText(rel, "SuccessorActivityObjectId");
        const relType   = getText(rel, "Type") || "Finish to Start";
        const lagHours  = parseFloat(getText(rel, "Lag") || "0");
        const lagDays   = Math.round(lagHours / HOURS_PER_DAY);
        const succActId = objIdToActId[succObjId] || succObjId;
        // Map type string → short code
        const typeMap = { "Finish to Start": "FS", "Start to Start": "SS", "Finish to Finish": "FF", "Start to Finish": "SF" };
        const linkCode = typeMap[relType] || "FS";
        if (predObjId && !relsByPredObjId[predObjId]) {
          relsByPredObjId[predObjId] = { succActId, linkCode, lagDays };
        }
      }

      // Emit in WBS order
      let lastWbs = null;
      for (const act of proj.querySelectorAll("Activity")) {
        const wbsId = getText(act, "WBSObjectId") || getText(act, "WBSId");
        if (wbsId !== lastWbs) {
          tasks.push({ isSection: true, sectionType: "blue", activity: getWbsName(wbsId) });
          lastWbs = wbsId;
        }
        const objId  = getText(act, "ObjectId");
        const actId  = getText(act, "Id") || getText(act, "ActivityId") || objId;
        const actName = getText(act, "Name");
        const actType = getText(act, "Type");

        // Dates: prefer actual, then early, then planned/target
        const actualStart  = normaliseDate(getText(act, "ActualStartDate")  || getText(act, "ActualStart"));
        const actualFinish = normaliseDate(getText(act, "ActualFinishDate") || getText(act, "ActualFinish"));
        const earlyStart   = normaliseDate(getText(act, "StartDate")  || getText(act, "EarlyStartDate")  || getText(act, "PlannedStartDate")  || getText(act, "Start"));
        const earlyFinish  = normaliseDate(getText(act, "FinishDate") || getText(act, "EarlyFinishDate") || getText(act, "PlannedFinishDate") || getText(act, "Finish"));

        let start = actualStart || earlyStart;
        let end   = actualFinish || earlyFinish;

        // Milestone handling
        if (actType === "StartMilestone" || actType === "MilestoneStart") { end = ""; }
        else if (actType === "FinishMilestone" || actType === "MilestoneFinish") { start = ""; }

        // Attach relationship (link) if this activity is a predecessor
        const rel = objId ? relsByPredObjId[objId] : null;

        tasks.push({
          isSection: false,
          activityId: actId,
          activity: actName || "(Unnamed)",
          start,
          end,
          barType: "baseline",
          startActual: actualStart ? true : undefined,
          endActual: actualFinish ? true : undefined,
          ...(rel ? { link: rel.linkCode, lag: rel.lagDays } : {}),
        });
      }
    }
    return tasks.length > 0 ? tasks : null;
  }

  // ── Approach 2: Generic XML with Activity/Task elements ──────────────────
  const actEls = Array.from(doc.querySelectorAll("Activity, Task, task, activity"));
  if (actEls.length > 0) {
    tasks.push({ isSection: true, sectionType: "blue", activity: "Imported Activities" });
    for (const act of actEls) {
      const actId   = getText(act, "Id") || getText(act, "ID") || act.getAttribute("id") || "";
      const actName = getText(act, "Name") || getText(act, "name") || getText(act, "Title") || "";
      const start   = normaliseDate(getText(act, "StartDate") || getText(act, "Start") || getText(act, "start_date"));
      const end     = normaliseDate(getText(act, "FinishDate") || getText(act, "Finish") || getText(act, "end_date"));
      if (!actName && !start && !end) continue;
      tasks.push({ isSection: false, activityId: actId, activity: actName || "(Unnamed)", start, end, barType: "baseline" });
    }
    return tasks.length > 1 ? tasks : null;
  }

  return null;
}

// ── PDF helpers ────────────────────────────────────
async function detectTrueRotation(pdfPage) {
  const metaRot = pdfPage.getViewport({ scale: 1 }).rotation;
  let textContent;
  try { textContent = await pdfPage.getTextContent(); } catch { return metaRot; }
  const items = textContent.items || [];
  if (items.length < 5) return metaRot;
  const sample = items.slice(0, 30);
  let normalCount = 0, rot90Count = 0, rot270Count = 0, rot180Count = 0;
  for (const item of sample) {
    const [a, b] = item.transform;
    if (Math.abs(a) > Math.abs(b)) { if (a > 0) normalCount++; else rot180Count++; }
    else { if (b > 0) rot90Count++; else rot270Count++; }
  }
  const maxCount = Math.max(normalCount, rot90Count, rot270Count, rot180Count);
  if (maxCount === normalCount) return 0;
  if (maxCount === rot90Count) return 270;
  if (maxCount === rot270Count) return 90;
  if (maxCount === rot180Count) return 180;
  return metaRot;
}

// Render a PDF page upright and return a Blob (faster than base64 toDataURL).
// Target ~2800px on the long edge so a 300 dpi A4 programme scan keeps its detail and
// dense ~6pt table text stays legible for the vision model. Measured on a real A4 P6
// print: 1263px long edge → 12 rows, 2800px+ → 31 rows.
const PDF_RENDER_LONG_EDGE = 2800;
const PDF_RENDER_MAX_SCALE = 4;

async function renderPageAsBlob(pdfPage, rotation) {
  const base = pdfPage.getViewport({ scale: 1, rotation });
  const longEdge = Math.max(base.width, base.height) || 1;
  const scale = Math.min(PDF_RENDER_MAX_SCALE, PDF_RENDER_LONG_EDGE / longEdge);
  const viewport = pdfPage.getViewport({ scale, rotation });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d");
  await pdfPage.render({ canvasContext: ctx, viewport }).promise;
  return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.75));
}



async function extractNativePDFText(pdf, pageNums) {
  // Extract all pages in parallel
  const pageTexts = await Promise.all(pageNums.map(async (pageNum) => {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const byY = {};
    for (const item of content.items) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!byY[y]) byY[y] = [];
      byY[y].push({ x: item.transform[4], str: item.str });
    }
    return Object.keys(byY).sort((a, b) => b - a)
      .map(y => byY[y].sort((a, b) => a.x - b.x).map(i => i.str).join("  "))
      .join("\n");
  }));
  return pageTexts.join("\n").trim();
}

// ── AI schema for Gantt tasks ──────────────────────
const GANTT_TASK_SCHEMA = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          is_section:        { type: "boolean" },
          section_type:      { type: "string" },
          activity:          { type: "string" },
          activity_id:       { type: "string" },
          item:              { type: "string" },
          start:             { type: "string" },
          end:               { type: "string" },
          baseline_start:    { type: "string" },
          baseline_finish:   { type: "string" },
          bar_type:          { type: "string" },
          start_actual:      { type: "boolean" },
          end_actual:        { type: "boolean" },
          remain_dur:        { type: "number" },
          float:             { type: "number" },
          pct:               { type: "number" },
          // Additional P6 fields
          early_start:       { type: "string" },
          early_finish:      { type: "string" },
          late_start:        { type: "string" },
          late_finish:       { type: "string" },
          free_float:        { type: "number" },
          expected_finish:   { type: "string" },
          primary_resource:  { type: "string" },
          duration_type:     { type: "string" },
          complete_pct_type: { type: "string" },
          status_code:       { type: "string" },
          constraint_type:   { type: "string" },
          constraint_date:   { type: "string" },
          constraint_type2:  { type: "string" },
          constraint_date2:  { type: "string" },
          suspend_date:      { type: "string" },
          resume_date:       { type: "string" },
          priority_type:     { type: "string" },
          location_id:       { type: "string" },
          est_wt:            { type: "number" },
          target_duration:   { type: "number" },
          driving_path_flag: { type: "string" },
          calendar:          { type: "string" },
        }
      }
    }
  }
};

// Vision paths (scanned PDF / image) use a much leaner schema than the text paths.
// Why: the model stops generating after only a couple of rows when each row must
// carry ~37 fields (measured on a real A4 P6 print: 37 fields → 3 rows, 16 fields → 31 rows).
// Only fields that can actually be printed on a chart are kept — the rest were
// hallucinated anyway (invented resources, calendars, constraints, status codes).
const GANTT_VISION_TASK_SCHEMA = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          is_section:        { type: "boolean" },
          section_type:      { type: "string" },
          activity_id:       { type: "string" },
          activity:          { type: "string" },
          item:              { type: "string" },
          start:             { type: "string" },
          end:               { type: "string" },
          baseline_start:    { type: "string" },
          baseline_finish:   { type: "string" },
          bar_type:          { type: "string" },
          start_actual:      { type: "boolean" },
          end_actual:        { type: "boolean" },
          remain_dur:        { type: "number" },
          float:             { type: "number" },
          pct:               { type: "number" },
          driving_path_flag: { type: "string" },
        }
      }
    }
  }
};

const GANTT_PROMPT_BASE = `You are a Primavera P6 and Gantt chart expert. Extract ALL schedule/programme data from the provided content into a structured Gantt chart format.

PERMISSIVE EXTRACTION RULE — CRITICAL:
- This document may NOT be a traditional Gantt chart. It could be ANY tabular schedule, programme, or activity list.
- If the data contains an ID column, a Name/Description column, and ANY date columns (Planned, Early, Late, Actual, Start, Finish, Baseline), extract EVERY row — even if it does not look like a Gantt activity.
- Having Activity ID + Activity Name + any date is COMPLETELY SUFFICIENT to extract a row. Do NOT skip rows just because they lack duration, float, or % complete.
- Extract EVERY data row. Do NOT skip any row that has an ID or Name or any date.

COMPLETENESS AND FIDELITY — CRITICAL:
- Do NOT stop after the first few rows. A page of a printed programme/chart normally holds 20-40 rows; keep extracting until every visible row is included, in source order.
- NEVER invent values. If a field is not shown in the source, leave it empty (null or omitted). Do NOT guess resources, calendars, constraint types, status codes or dates that are not visible.

EXTRACTION RULES:
- Extract EVERY row: both section headers AND activity rows.
- SECTION HEADERS: rows that are programme/section titles (e.g. "Baseline Programme", "Delay Analysis Programme", "Phase 1"). Set is_section=true, put the title in "activity", leave start/end null. section_type = "blue" (default) or "pink" for delay/comparison programmes.
- ACTIVITY ROWS: rows with activity name and/or dates. Set is_section=false.
- activity_id = the P6 activity code or any ID column (e.g. CLP-5060, INTS2-1030a, ACT-001, or any identifier). If the column is labelled "ID", "Activity ID", "Task ID", "Code", use it.
- activity = the activity name or description. If the column is labelled "Name", "Activity Name", "Task Name", "Description", "Work", use it.
- item = the item number shown on the Gantt bar (e.g. A1, B2, DE1).
- bar_type = "delay" if row is a delay event/period, otherwise "baseline".
- Convert ALL dates to YYYY-MM-DD format (e.g. "02-Oct-22" → "2022-10-02", "10/25/2024" → "2024-10-25", "25-Dec-25" → "2025-12-25").
- Date values may have a trailing letter suffix (e.g. "10-Nov-21 A", "02-Apr-27 A") — strip the letter suffix and use the date only.

DATE COLUMN MAPPING — CRITICAL:
- Columns labelled "Planned Start/Finish", "Early Start/Finish", "Start", "Finish", "Begin", "Complete" → map to start / end (these are the current/planned dates).
- Columns labelled "Late Start" / "Late Finish" → map to late_start / late_finish.
- Columns labelled "BL Start/Finish", "Baseline Start/Finish", "Target Start/Finish" → map to baseline_start / baseline_finish.
- Columns labelled "Actual Start" / "Actual Finish" → map to start / end AND set start_actual=true / end_actual=true.
- If a date has an "A" suffix or is marked as Actual (e.g. red text, "A" letter), set start_actual=true or end_actual=true.
- If ONLY Late columns exist (no plain Start/Finish), map them to late_start / late_finish and leave start/end null.
- If ONLY Baseline columns exist (no plain Start/Finish), use them as start / end and leave baseline_start/baseline_finish null.
- remain_dur = Remaining Duration (numeric days). Look for columns named "Rem Dur", "Remaining Duration", "Rem. Duration", "RD" etc.
- float = Total Float (numeric days, may be negative). Look for columns named "Float", "Total Float", "TF", "Late Float" etc.
- pct = Schedule % Complete or Activity % Complete (0–100 numeric). Look for columns named "% Complete", "% Comp", "Activity % Comp", "Schedule % Comp" etc.
- Use null for any blank/missing field.
- Do NOT skip any row.`;

function nullToEmpty(val) {
  if (val === null || val === undefined || String(val).toLowerCase() === "null") return "";
  return String(val).trim() === "null" ? "" : val;
}

function aiResultToTasks(aiTasks) {
  if (!Array.isArray(aiTasks)) return [];
  return aiTasks.map(t => {
    // Handle Late Start/Late Finish milestone logic
    let lateStartVal = nullToEmpty(t.late_start);
    let lateEndVal = nullToEmpty(t.late_finish);
    
    // Check if Late dates indicate a milestone (only one of late_start/late_finish has value)
    const hasLateStart = lateStartVal && lateStartVal !== "";
    const hasLateEnd = lateEndVal && lateEndVal !== "";
    
    // If only late_start exists → Start Milestone (keep start, clear end)
    // If only late_finish exists → Finish Milestone (keep end, clear start)
    if (hasLateStart && !hasLateEnd) {
      lateEndVal = "";
    } else if (!hasLateStart && hasLateEnd) {
      lateStartVal = "";
    }
    
    return {
      isSection: !!t.is_section,
      sectionType: t.section_type || "blue",
      activity: nullToEmpty(t.activity),
      activityId: nullToEmpty(t.activity_id),
      item: (t.item && String(t.item).toLowerCase() !== "null") ? t.item : undefined,
      start: nullToEmpty(t.start),
      end: nullToEmpty(t.end),
      baselineStart: nullToEmpty(t.baseline_start),
      baselineFinish: nullToEmpty(t.baseline_finish),
      barType: t.bar_type === "delay" ? "delay" : "baseline",
      startActual: t.start_actual || undefined,
      endActual: t.end_actual || undefined,
      ...(t.remain_dur != null ? { remainDur: t.remain_dur } : {}),
      ...(t.float != null ? { float: t.float } : {}),
      ...(t.pct != null ? { pct: t.pct } : {}),
      // ── Additional P6 fields ───────────────────────────────────────
      ...(t.early_start ? { earlyStart: nullToEmpty(t.early_start) || undefined } : {}),
      ...(t.early_finish ? { earlyEnd: nullToEmpty(t.early_finish) || undefined } : {}),
      ...(lateStartVal ? { lateStart: lateStartVal } : {}),
      ...(lateEndVal ? { lateEnd: lateEndVal } : {}),
      ...(t.free_float != null ? { freeFloat: t.free_float } : {}),
      ...(t.expected_finish ? { expectedFinish: nullToEmpty(t.expected_finish) || undefined } : {}),
      ...(t.primary_resource ? { primaryResource: nullToEmpty(t.primary_resource) || undefined } : {}),
      ...(t.duration_type ? { durationType: nullToEmpty(t.duration_type) || undefined } : {}),
      ...(t.complete_pct_type ? { completePctType: nullToEmpty(t.complete_pct_type) || undefined } : {}),
      ...(t.status_code ? { statusCode: nullToEmpty(t.status_code) || undefined } : {}),
      ...(t.constraint_type ? { constraintType: nullToEmpty(t.constraint_type) || undefined } : {}),
      ...(t.constraint_date ? { constraintDate: nullToEmpty(t.constraint_date) || undefined } : {}),
      ...(t.constraint_type2 ? { constraintType2: nullToEmpty(t.constraint_type2) || undefined } : {}),
      ...(t.constraint_date2 ? { constraintDate2: nullToEmpty(t.constraint_date2) || undefined } : {}),
      ...(t.suspend_date ? { suspendDate: nullToEmpty(t.suspend_date) || undefined } : {}),
      ...(t.resume_date ? { resumeDate: nullToEmpty(t.resume_date) || undefined } : {}),
      ...(t.priority_type ? { priorityType: nullToEmpty(t.priority_type) || undefined } : {}),
      ...(t.location_id ? { locationId: nullToEmpty(t.location_id) || undefined } : {}),
      ...(t.est_wt != null ? { estWt: t.est_wt } : {}),
      ...(t.target_duration != null ? { targetDuration: t.target_duration } : {}),
      ...(t.driving_path_flag ? { drivingPathFlag: nullToEmpty(t.driving_path_flag) || undefined } : {}),
      ...(t.calendar ? { calendar: nullToEmpty(t.calendar) || undefined } : {}),
    };
  }).filter(t => t.activity || t.activityId || t.start || t.end || t.lateStart || t.lateEnd || t.baselineStart || t.baselineFinish);
}

async function processPDF(file, onProgress) {
  onProgress("Reading PDF...");
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // ── Fast path: read embedded Gantt data from PDF metadata (instant, no AI) ──
  // Every PDF exported by this app carries the full task array (GANTT_DATA_V3/V2),
  // so re-uploading it restores every field exactly — no OCR/vision pass.
  try {
    onProgress("Checking for embedded data...");
    const meta = await pdf.getMetadata();
    const info = meta?.info || {};
    const parsed = await decodeTasksFromPDFInfo(info);
    if (parsed && parsed.length > 0) {
      onProgress(`✓ Embedded data found — ${parsed.length} records restored instantly!`);
      return parsed;
    }
  } catch (_) {
    // No embedded data or corrupt — fall through to AI extraction
  }

  const totalPages = pdf.numPages;
  // Batch 7: send EVERY page. The old code always dropped page 1 on multi-page files
  // (`firstPage = totalPages === 1 ? 1 : 2`, assuming a cover page), which silently
  // lost 25% of a 4-page scan-only programme. Pages that contain no table simply come
  // back with no rows; the import preview lets the user delete any stray row.
  const schedulePageNums = Array.from({ length: totalPages }, (_, i) => i + 1);

  // Try native text extraction first
  onProgress("Attempting native text extraction...");
  const nativeText = await extractNativePDFText(pdf, schedulePageNums);
  // Broaden date detection: accept YYYY-MM-DD, DD-Mon-YY, DD/MM/YYYY, Mon DD YYYY, etc.
  const datePattern = /\d{4}-\d{2}-\d{2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{1,2}[-\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s]\d{2,4}/i;
  const hasStructuredText = nativeText.length > 200 && datePattern.test(nativeText);

  if (hasStructuredText) {
    onProgress("Parsing text content with AI...");
    const extracted = await base44.integrations.Core.InvokeLLM({
      prompt: `${GANTT_PROMPT_BASE}\n\nFile: ${file.name}\n\nText content:\n${nativeText.substring(0, 24000)}`,
      response_json_schema: GANTT_TASK_SCHEMA,
      model: "gemini_3_1_pro",
    });
    return aiResultToTasks(extracted.tasks || []);
  }

  // Scanned PDF → full pipeline per page in parallel (render → upload → AI all concurrent)
  onProgress(`Processing ${schedulePageNums.length} page(s) in parallel...`);
  const allTaskArrays = await Promise.all(
    schedulePageNums.map(async (pageNum) => {
      // 1. Render
      const pdfPage = await pdf.getPage(pageNum);
      const trueRot = await detectTrueRotation(pdfPage);
      const blob = await renderPageAsBlob(pdfPage, trueRot);
      // 2. Upload
      const imgFile = new File([blob], `p${pageNum}.jpg`, { type: "image/jpeg" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file: imgFile });
      // 3. AI analyse
      const extracted = await base44.integrations.Core.InvokeLLM({
        prompt: `${GANTT_PROMPT_BASE}\n\nThis is page ${pageNum} of ${totalPages} from file: ${file.name}.\nThe image has been pre-rotated to the correct reading orientation — read left-to-right, top-to-bottom.`,
        file_urls: [file_url],
        response_json_schema: GANTT_VISION_TASK_SCHEMA,
        model: "gemini_3_1_pro",
      });
      return aiResultToTasks(extracted.tasks || []);
    })
  );
  return allTaskArrays.flat();
}

async function processImage(file, onProgress) {
  onProgress("Uploading image...");
  const uploadResult = await base44.integrations.Core.UploadFile({ file });
  onProgress("Analysing with AI Vision...");
  const extracted = await base44.integrations.Core.InvokeLLM({
    prompt: `${GANTT_PROMPT_BASE}\n\nFile: ${file.name}`,
    file_urls: [uploadResult.file_url],
    response_json_schema: GANTT_VISION_TASK_SCHEMA,
    model: "gemini_3_1_pro",
  });
  return aiResultToTasks(extracted.tasks || []);
}

// ── Editable preview table ────────────────────────────────────
function safeVal(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  return s.toLowerCase() === "null" ? "" : s;
}

function PreviewTable({ tasks, onChange }) {
  const updateRow = (idx, field, value) => onChange(tasks.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  const deleteRow = (idx) => onChange(tasks.filter((_, i) => i !== idx));

  return (
    <div className="border border-border rounded-lg overflow-auto max-h-64 mb-3">
      <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%", minWidth: 620 }}>
        <thead>
          <tr style={{ background: "#003531", color: "#fff", fontSize: 11 }}>
            <th style={{ width: 22, padding: "4px 2px", textAlign: "center", border: "1px solid #003531" }}>#</th>
            <th style={{ width: 42, padding: "4px 3px", textAlign: "center", border: "1px solid #003531" }}>Type</th>
            <th style={{ width: 42, padding: "4px 3px", textAlign: "center", border: "1px solid #003531" }}>Item</th>
            <th style={{ width: 110, padding: "4px 3px", textAlign: "center", border: "1px solid #003531" }}>ID</th>
            <th style={{ padding: "4px 6px", textAlign: "left", border: "1px solid #003531" }}>Activity</th>
            <th style={{ width: 104, padding: "4px 4px", textAlign: "center", border: "1px solid #003531" }}>Start</th>
            <th style={{ width: 104, padding: "4px 4px", textAlign: "center", border: "1px solid #003531" }}>End</th>
            <th style={{ width: 104, padding: "4px 4px", textAlign: "center", border: "1px solid #003531", background:"#003531" }}>Late Start</th>
            <th style={{ width: 104, padding: "4px 4px", textAlign: "center", border: "1px solid #003531", background:"#003531" }}>Late Finish</th>
            <th style={{ width: 56, padding: "4px 3px", textAlign: "center", border: "1px solid #003531", background:"#001c19" }}>Rem.Dur</th>
            <th style={{ width: 50, padding: "4px 3px", textAlign: "center", border: "1px solid #003531", background:"#001c19" }}>Float</th>
            <th style={{ width: 50, padding: "4px 3px", textAlign: "center", border: "1px solid #003531", background:"#001c19" }}>% Comp</th>
            <th style={{ width: 22, border: "1px solid #003531" }}></th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, i) => (
            <tr key={i} style={{ background: t.isSection ? (t.sectionType === "pink" ? "#f7f7f7" : "#005a53") : i % 2 === 0 ? "#fff" : "#f7f7f7", fontSize: 12 }}>
              <td style={{ textAlign: "center", color: t.isSection ? (t.sectionType === "pink" ? "#733208" : "#ffffff") : "#6c757d", border: "1px solid #cecece", padding: "2px" }}>{i + 1}</td>
              <td style={{ border: "1px solid #cecece", padding: 0 }}>
                <input type="text" value={t.barType === "delay" ? "DE" : "BL"} onChange={e => updateRow(i, "barType", e.target.value.toUpperCase() === "DE" ? "delay" : "baseline")} className="w-full px-1 outline-none bg-transparent text-center focus:bg-surface-subtle" style={{ height: 24, border: "none", fontSize: 11, fontWeight: 700, color: t.barType === "delay" ? "#e88219" : "#005a53" }} />
              </td>
              <td style={{ border: "1px solid #cecece", padding: 0 }}>
                <input type="text" value={safeVal(t.item)} onChange={e => updateRow(i, "item", e.target.value)} className="w-full px-1 outline-none bg-transparent text-center focus:bg-surface-subtle" style={{ height: 24, border: "none", fontSize: 11, color: t.isSection ? "#fff" : undefined }} />
              </td>
              <td style={{ border: "1px solid #cecece", padding: 0 }}>
                <input type="text" value={safeVal(t.activityId)} onChange={e => updateRow(i, "activityId", e.target.value)} placeholder={t.isSection ? "" : "e.g. S9-CW0610"} className="w-full px-1 outline-none bg-transparent text-center focus:bg-surface-subtle" style={{ height: 24, border: "none", fontSize: 11, color: t.isSection ? "#ffffff" : "#005a53", fontFamily: "monospace" }} />
              </td>
              <td style={{ border: "1px solid #cecece", padding: 0 }}>
                <input type="text" value={safeVal(t.activity)} onChange={e => updateRow(i, "activity", e.target.value)} className="w-full px-2 outline-none bg-transparent focus:bg-surface-subtle" style={{ height: 24, border: "none", fontSize: 12, color: t.isSection ? (t.sectionType === "pink" ? "#733208" : "#fff") : undefined, fontWeight: t.isSection ? 700 : undefined }} />
              </td>
              <td style={{ border: "1px solid #cecece", padding: 0 }}>
                <input type="date" value={safeVal(t.start)} onChange={e => updateRow(i, "start", e.target.value)} className="w-full px-1 outline-none bg-transparent focus:bg-surface-subtle" style={{ height: 24, border: "none", fontSize: 11, color: t.startActual ? "#dc3545" : undefined, fontWeight: t.startActual ? 600 : undefined }} />
              </td>
              <td style={{ border: "1px solid #cecece", padding: 0 }}>
                <input type="date" value={safeVal(t.end)} onChange={e => updateRow(i, "end", e.target.value)} className="w-full px-1 outline-none bg-transparent focus:bg-surface-subtle" style={{ height: 24, border: "none", fontSize: 11, color: t.endActual ? "#dc3545" : undefined, fontWeight: t.endActual ? 600 : undefined }} />
              </td>
              <td style={{ border: "1px solid #cecece", padding: 0, background:"#f7f7f7" }}>
                <input type="date" value={safeVal(t.lateStart)} onChange={e => updateRow(i, "lateStart", e.target.value)} className="w-full px-1 outline-none bg-transparent focus:bg-surface-subtle" style={{ height: 24, border: "none", fontSize: 11, color: "#005a53" }} />
              </td>
              <td style={{ border: "1px solid #cecece", padding: 0, background:"#f7f7f7" }}>
                <input type="date" value={safeVal(t.lateEnd)} onChange={e => updateRow(i, "lateEnd", e.target.value)} className="w-full px-1 outline-none bg-transparent focus:bg-surface-subtle" style={{ height: 24, border: "none", fontSize: 11, color: "#005a53" }} />
              </td>
              <td style={{ border: "1px solid #cecece", padding: 0, background:"#f7f7f7", textAlign:"center" }}>
                <span style={{ fontSize: 11, color: t.remainDur != null ? "#003531" : "#cecece", fontFamily: "monospace" }}>{t.remainDur != null ? t.remainDur : "–"}</span>
              </td>
              <td style={{ border: "1px solid #cecece", padding: 0, background:"#f7f7f7", textAlign:"center" }}>
                <span style={{ fontSize: 11, color: t.float != null ? (Number(t.float) < 0 ? "#dc3545" : "#003531") : "#cecece", fontFamily: "monospace" }}>{t.float != null ? t.float : "–"}</span>
              </td>
              <td style={{ border: "1px solid #cecece", padding: 0, background:"#f7f7f7", textAlign:"center" }}>
                <span style={{ fontSize: 11, color: t.pct != null ? "#003531" : "#cecece", fontFamily: "monospace" }}>{t.pct != null ? `${t.pct}%` : "–"}</span>
              </td>
              <td style={{ border: "1px solid #cecece", textAlign: "center" }}>
                <button onClick={() => deleteRow(i)} className="text-danger hover:text-danger"><Trash2 size={11} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function ImageImportDialog({ onImport, onClose, initialFile, onSetProjectTitle }) {
  const [mode, setMode] = useState(null);
  const [excelInfo, setExcelInfo] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [progressLabel, setProgressLabel] = useState("");
  const [parsedTasks, setParsedTasks] = useState(null);
  const [importMode, setImportMode] = useState("append"); // "append" | "replace" | "set_baseline"
  const [parsedFileType, setParsedFileType] = useState("File");
  // Raw tables of an imported XER — kept so exporting back to XER is lossless
  // (see buildXERPassThrough). Passed to the page with the parsed tasks.
  const [xerSource, setXerSource] = useState(null);
  const [sourceFileName, setSourceFileName] = useState("");
  const xerFileRef = useRef();
  const excelFileRef = useRef();

  // Auto-process a file dropped from the empty-state zone
  useEffect(() => {
    if (!initialFile) return;
    const f = initialFile;
    setSourceFileName(f.name.replace(/\.[^.]+$/, "")); // strip extension
    if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) handlePdfFile(f);
    else if (f.type.startsWith("image/")) handleImageFile(f);
    else if (f.name.toLowerCase().endsWith(".xer")) handleXerFile(f);
    else if (f.name.toLowerCase().endsWith(".xml")) handleXmlFile(f);
    else if (/xlsx|xls|csv/.test(f.name.split(".").pop().toLowerCase())) handleExcelFile(f);
   
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExcelFile = (f) => {
    if (!f) return;
    setSourceFileName(f.name.replace(/\.[^.]+$/, "")); // strip extension
    setParsedFileType("Excel");
    setMode("excel");
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: "array" });
      // Auto-select TASK sheet if present (P6 Activities format)
      const preferred = wb.SheetNames.find(s => s === "TASK") || wb.SheetNames[0];
      setExcelInfo({ workbook: wb, sheets: wb.SheetNames, selectedSheet: preferred });
      setStatus("idle"); setParsedTasks(null);
    };
    reader.readAsArrayBuffer(f);
  };

  const handleXerFile = (f) => {
    if (!f) return;
    setSourceFileName(f.name.replace(/\.[^.]+$/, "")); // strip extension
    setMode("xer"); setStatus("loading"); setProgressLabel("Parsing XER..."); setParsedFileType("XER");
    const reader = new FileReader();
    reader.onload = (e) => {
      const tasks = parseXER(e.target.result);
      if (!tasks || tasks.length === 0) { setStatus("error"); return; }
      setXerSource(parseXerTables(e.target.result));   // keep every raw table for lossless export
      setParsedTasks(tasks); setStatus("done");
    };
    reader.readAsText(f, "utf-8");
  };

  const handleXmlFile = (f) => {
    if (!f) return;
    setSourceFileName(f.name.replace(/\.[^.]+$/, "")); // strip extension
    setMode("xml"); setStatus("loading"); setProgressLabel("Parsing P6 XML..."); setParsedFileType("P6 XML");
    setXerSource(null);                                // XML has no XER tables to pass through
    const reader = new FileReader();
    reader.onload = (e) => {
      const tasks = parseP6XML(e.target.result);
      if (!tasks || tasks.length === 0) { setStatus("error"); return; }
      setParsedTasks(tasks); setStatus("done");
    };
    reader.readAsText(f, "utf-8");
  };

  const handlePdfFile = useCallback(async (f) => {
    if (!f) return;
    setSourceFileName(f.name.replace(/\.[^.]+$/, "")); // strip extension
    setParsedFileType("PDF");
    setMode("pdf"); setStatus("loading"); setParsedTasks(null);
    const tasks = await processPDF(f, (label) => setProgressLabel(label));
    if (!tasks || tasks.length === 0) { setStatus("error"); return; }
    setParsedTasks(tasks); setStatus("done");
  }, []);

  const handleImageFile = useCallback(async (f) => {
    if (!f) return;
    setSourceFileName(f.name.replace(/\.[^.]+$/, "")); // strip extension
    setParsedFileType("Image");
    setMode("image"); setStatus("loading"); setProgressLabel("Uploading image..."); setParsedTasks(null);
    const tasks = await processImage(f, (label) => setProgressLabel(label));
    if (!tasks || tasks.length === 0) { setStatus("error"); return; }
    setParsedTasks(tasks); setStatus("done");
  }, []);

  // Paste image from clipboard — placed after handleImageFile to avoid TDZ error
  useEffect(() => {
    const handlePaste = (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imgItem = items.find(item => item.type.startsWith("image/"));
      if (!imgItem) return;
      const blob = imgItem.getAsFile();
      if (!blob) return;
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const file = new File([blob], `screenshot-${ts}.png`, { type: blob.type });
      handleImageFile(file);
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handleImageFile]);

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) { handlePdfFile(f); }
    else if (f.type.startsWith("image/")) { handleImageFile(f); }
    else if (f.name.toLowerCase().endsWith(".xer")) { handleXerFile(f); }
    else if (f.name.toLowerCase().endsWith(".xml")) { handleXmlFile(f); }
    else if (/xlsx|xls|csv/.test(f.name.split(".").pop().toLowerCase())) { handleExcelFile(f); }
  };

  const handleExcelParse = async () => {
    if (!excelInfo) return;
    setStatus("loading"); setProgressLabel("Parsing Excel...");
    // Yield to UI before heavy synchronous work
    await new Promise(r => setTimeout(r, 0));
    // Default: parse ALL sheets and combine their content
    let tasks = parseExcelAllSheets(excelInfo.workbook);
    // If rule-based parser returns nothing or very few results, fall back to AI on all sheets
    if (tasks.length < 2) {
      tasks = await parseExcelWithAI(excelInfo.workbook, excelInfo.sheets, (label) => setProgressLabel(label));
    }
    if (!tasks || tasks.length === 0) { setStatus("error"); return; }
    setParsedTasks(tasks); setStatus("done");
  };

  const handleImport = () => {
    if (parsedTasks) {
      onImport(parsedTasks, importMode, parsedFileType, xerSource);
      // Set project title from source filename
      if (onSetProjectTitle && sourceFileName) {
        onSetProjectTitle(sourceFileName);
      }
      onClose();
    }
  };

  const isLoading = status === "loading";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl shadow-2xl p-6" style={{ width: 860, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto" }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-text flex items-center gap-2">
            <Upload size={18} className="text-primary" /> Import Data
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>

        {status !== "done" && (
          <>
            {!isLoading && (
              <>
                {/* Drop zone */}
                <div
                  onClick={() => {
                    const el = document.createElement("input");
                    el.type = "file";
                    el.accept = ".pdf,.xer,.xml,.xlsx,.xls,.csv,image/*";
                    el.onchange = e => handleDrop({ preventDefault: () => {}, dataTransfer: { files: e.target.files } });
                    el.click();
                  }}
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:bg-surface-subtle hover:border-primary transition-all mb-3"
                >
                  <div className="flex flex-col items-center gap-3 text-text-muted">
                    <Upload size={36} className="text-text-muted" />
                    <div>
                      <span className="text-sm font-semibold text-text-muted block">Click / Paste (Ctrl+V) / Drag &amp; Drop</span>
                      <span className="text-xs text-text-muted mt-1 block">PDF · Image (AI Vision) · Excel / CSV · Primavera P6 XER / XML</span>
                    </div>
                    <div className="flex gap-2 mt-1 flex-wrap justify-center">
                      {[
                        { label: "PDF", color: "bg-surface-subtle text-danger" },
                        { label: "Image", color: "bg-surface-subtle text-primary" },
                        { label: "Excel / CSV", color: "bg-surface-subtle text-success" },
                        { label: "P6 XER", color: "bg-table-header text-accent-selected" },
                        { label: "P6 XML", color: "bg-table-header text-accent-selected" },
                      ].map(b => (
                        <span key={b.label} className={`px-2 py-0.5 rounded text-xs font-medium ${b.color}`}>{b.label}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <input ref={excelFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleExcelFile(e.target.files[0])} />
                <input ref={xerFileRef} type="file" accept=".xer" className="hidden" onChange={e => handleXerFile(e.target.files[0])} />

                {/* Excel sheet selector */}
                {mode === "excel" && excelInfo && (
                  <div className="mb-3 flex items-center gap-3 p-3 bg-surface-subtle border border-border rounded-lg">
                    <FileSpreadsheet size={18} className="text-success flex-shrink-0" />
                    <span className="text-sm font-medium text-success flex-1">Loaded: {excelInfo.selectedSheet} ({excelInfo.sheets.length} sheet{excelInfo.sheets.length > 1 ? "s" : ""})</span>
                    {excelInfo.sheets.length > 1 && (
                      <select className="border border-border rounded px-2 py-1 text-xs" value={excelInfo.selectedSheet} onChange={e => setExcelInfo(prev => ({ ...prev, selectedSheet: e.target.value }))}>
                        {excelInfo.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Loading progress */}
            {isLoading && (
              <div className="mb-3">
                <div className="flex items-center gap-2 text-primary text-sm mb-2">
                  <Loader2 size={13} className="animate-spin" />
                  {progressLabel || "Processing..."}
                </div>
                <div className="w-full bg-surface-muted rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "60%" }} />
                </div>
                {(mode === "pdf" || mode === "image") && (
                  <p className="text-xs text-text-muted mt-2">AI Vision analysis may take 10–30 seconds per page. Please wait…</p>
                )}
              </div>
            )}

            {status === "error" && (
              <div className="mb-3 bg-surface-subtle border border-border rounded-lg p-3 text-sm text-danger">
                ❌ Could not parse this file. Please check the format and try again.
              </div>
            )}
          </>
        )}

        {/* Preview / Edit table */}
        {status === "done" && parsedTasks && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text">
                Preview (<strong>{parsedTasks.length}</strong> records) — edit inline before confirming
              </span>
              <button onClick={() => { setStatus("idle"); setParsedTasks(null); setExcelInfo(null); setMode(null); }} className="text-xs text-text-muted hover:text-text underline">
                Re-upload
              </button>
            </div>
            <PreviewTable tasks={parsedTasks} onChange={setParsedTasks} />
            <div className="flex items-center gap-4 mb-2 text-sm">
              <span className="text-text-muted text-xs font-medium">Import mode:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="importMode" value="append" checked={importMode === "append"} onChange={() => setImportMode("append")} className="accent-primary" />
                <span className="text-text text-xs">Append to existing data</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="importMode" value="replace" checked={importMode === "replace"} onChange={() => setImportMode("replace")} className="accent-danger" />
                <span className="text-danger text-xs">Replace all existing data</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="importMode" value="set_baseline" checked={importMode === "set_baseline"} onChange={() => setImportMode("set_baseline")} className="accent-primary" />
                <span className="text-primary text-xs font-medium">Set as Baseline (match by ID → fill BL dates)</span>
              </label>
            </div>
            {importMode === "set_baseline" && (
              <div className="mb-2 px-3 py-2 bg-surface-subtle border border-border rounded-lg text-xs text-primary">
                📐 Matches existing tasks by Activity ID and writes the imported Start/End into <strong>BL Start / BL Finish</strong>. Tasks without a matching ID will be skipped.
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center gap-2 mt-2">
          <Button
            variant="outline" size="sm"
            onClick={() => {
              const wb = XLSX.utils.book_new();
              const sampleData = [
                ["Color", "Type", "Item", "ID", "Activity", "Start", "End"],
                ["A", "", "", "", "Baseline Programme", "", ""],
                ["", "BL", "A1", "S9-CW0101", "Excavation Works", "2025-01-06", "2025-01-31"],
                ["", "BL", "A2", "S9-CW0201", "Foundation Works", "2025-02-03", "2025-03-14"],
                ["", "BL", "A3", "S9-CW0301", "Structural Works", "2025-03-17", "2025-06-30"],
                ["B", "", "", "", "Delay Programme", "", ""],
                ["", "DE", "A1", "S9-CW0101", "Excavation Works", "2025-01-06", "2025-02-14"],
                ["", "DE", "A2", "S9-CW0201", "Foundation Works", "2025-02-17", "2025-04-04"],
                ["", "DE", "A3", "S9-CW0301", "Structural Works", "2025-04-07", "2025-07-31"],
              ];
              const ws = XLSX.utils.aoa_to_sheet(sampleData);
              ws["!cols"] = [{ wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 16 }, { wch: 40 }, { wch: 14 }, { wch: 14 }];
              XLSX.utils.book_append_sheet(wb, ws, "Gantt Data");
              const wbsData = [["Activity ID","Activity Name","Start Date","Finish Date"],["WBS-1","Baseline Programme","",""],["ACT-001","Excavation Works","2025-01-06","2025-01-31"],["ACT-002","Foundation Works","2025-02-03","2025-03-14"],["ACT-003","Structural Works","2025-03-17","2025-06-30"],["WBS-2","Delay Programme","",""],["ACT-001","Excavation Works","2025-01-06","2025-02-14"],["ACT-002","Foundation Works","2025-02-17","2025-04-04"],["ACT-003","Structural Works","2025-04-07","2025-07-31"]];
              const wsWbs = XLSX.utils.aoa_to_sheet(wbsData); wsWbs["!cols"] = [{ wch: 16 }, { wch: 40 }, { wch: 14 }, { wch: 14 }];
              XLSX.utils.book_append_sheet(wb, wsWbs, "WBS Format Sample");
              const instrData = [["Column","Description","Example"],["Color","'A' = blue section header, 'B' = pink section header. Leave empty for normal rows.","A"],["Type","Bar type: BL = Baseline (default), DE = Delay. Defaults to BL if empty.","DE"],["Item","Item label shown on the Gantt bar.","A1"],["ID","Activity ID / code.","S9-CW0610"],["Activity","Activity name or section title.","Site Preparation"],["Start","Start date YYYY-MM-DD. Append ' A' for Actual Date.","2025-01-06"],["End","End date YYYY-MM-DD. Append ' A' for Actual Date.","2025-02-15"],["","",""],["WBS Format:","If Activity ID starts with WBS- (e.g. WBS-1), it becomes a Programme section header.","WBS-1"]];
              const wsInstr = XLSX.utils.aoa_to_sheet(instrData); wsInstr["!cols"] = [{ wch: 12 }, { wch: 65 }, { wch: 20 }];
              XLSX.utils.book_append_sheet(wb, wsInstr, "Instructions");
              XLSX.writeFile(wb, "gantt_sample_template.xlsx");
            }}
            className="flex items-center gap-1.5 text-success border-success hover:bg-surface-subtle"
          >
            <Download size={13} /> Download Template
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          {status === "done" ? (
            <Button size="sm" className="bg-success hover:bg-primary-dark text-surface" onClick={handleImport} disabled={!parsedTasks || parsedTasks.length === 0}>
              <CheckCircle size={14} className="mr-1" /> Confirm Import ({parsedTasks?.length ?? 0} rows)
            </Button>
          ) : isLoading ? (
            <Button size="sm" disabled className="bg-text-muted text-surface">
              <Loader2 size={14} className="mr-1 animate-spin" /> Processing...
            </Button>
          ) : mode === "excel" && excelInfo ? (
            <Button size="sm" disabled={isLoading} onClick={handleExcelParse} className="bg-success hover:bg-primary-dark text-surface">
              <FileSpreadsheet size={14} className="mr-1" /> Parse &amp; Preview
            </Button>
          ) : (
            <span className="text-xs text-text-muted italic">Upload a file to get started</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Export parse functions for reuse in CompareDialog
async function parseExcelFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const tasks = parseExcelAllSheets(wb);
  if (tasks.length >= 2) return tasks;
  // Fallback to AI across all sheets
  return parseExcelWithAI(wb, wb.SheetNames, () => {});
}

export { parseExcelFile, parseExcelSheet, parseExcelAllSheets, parseXER as parseXERFile, parseP6XML as parseXMLFile };