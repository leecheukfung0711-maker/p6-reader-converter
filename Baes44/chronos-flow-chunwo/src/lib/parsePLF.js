/**
 * parsePLF.js — Parser for Primavera P6 PLF layout files
 *
 * Supports THREE formats:
 *  1. Our custom XML format (produced by buildPLF)
 *  2. P6 "Structured Text" with || pipe-delimiters
 *  3. P6 "Structured Text" S-expression format (native Oracle export)
 *
 * Output: { columnVisibility: { [key]: { visible, position } }, cw: { [key]: width }, filters?: { logic, conditions, groups } }
 */

// ── Internal key ↔ display title ──────────────────────────────────────────
const KEY_TO_TITLE = {
  type:       "Type",
  rownum:     "Row Number",
  item:       "Item",
  activityId: "Activity ID",
  activity:   "Activity Name",
  start:      "Start Date",
  end:        "End Date",
  link:       "Link",
  duration:   "Duration",
  remainDur:  "Rem. Dur",
  float:      "Float",
  pct:        "% Comp",
  blStart:    "BL Start",
  blEnd:      "BL End",
  // P6 extended fields
  earlyStart:       "Early Start",
  earlyEnd:         "Early Finish",
  lateStart:        "Late Start",
  lateEnd:          "Late Finish",
  freeFloat:        "Free Float",
  expectedFinish:   "Exp. Finish",
  primaryResource:  "Resource",
  durationType:     "Dur. Type",
  completePctType:  "% Type",
  statusCode:       "Status",
  constraintType:   "Constraint",
  constraintDate:   "Const. Date",
  constraintType2:  "Const.2",
  constraintDate2:  "Const.2 Date",
  suspendDate:      "Suspend",
  resumeDate:       "Resume",
  priorityType:     "Priority",
  locationId:       "Location",
  estWt:            "Est Wt",
  drivingPathFlag:  "Long.Path",
  lockPlanFlag:     "Lock Plan",
  autoComputeActFlag: "Auto Actuals",
  actLaborUnits:    "Act.Labor",
  actNonlaborUnits: "Act.NonLabor",
  remLaborUnits:    "Rem.Labor",
  remNonlaborUnits: "Rem.NonLabor",
  planLaborUnits:   "Plan Labor",
  planNonlaborUnits:"Plan NonLabor",
  reviewFinish:     "Review Finish",
  reviewStatus:     "Review Status",
  externalEarlyStart: "Ext.ES",
  externalLateFinish: "Ext.LF",
  remEarlyStart:    "Rem.ES",
  remEarlyFinish:   "Rem.EF",
  remLateStart:     "Rem.LS",
  remLateFinish:    "Rem.LF",
  floatPath:        "Float Path",
  floatPathOrder:   "FP Order",
  p6Guid:           "GUID",
  p6TaskId:         "P6 ID",
  targetDuration:   "Plan.Dur",
};
const TITLE_TO_KEY = Object.fromEntries(Object.entries(KEY_TO_TITLE).map(([k,v])=>[v,k]));

// ── P6 database field name → our internal key ─────────────────────────────
const P6_FIELD_TO_KEY = {
  // Primary identifiers
  task_code:                    "activityId",
  task_name:                    "activity",
  wbs_id:                       "item",
  // Date fields
  start_date:                   "start",
  end_date:                     "end",
  early_start_date:             "earlyStart",
  early_end_date:               "earlyEnd",
  late_start_date:              "lateStart",
  late_end_date:                "lateEnd",
  act_start_date:               "start",
  act_end_date:                 "end",
  target_start_date:            "start",
  target_end_date:              "end",
  restart_date:                 "start",
  reend_date:                   "end",
  expect_end_date:              "expectedFinish",
  cstr_date:                    "constraintDate",
  cstr_date2:                   "constraintDate2",
  suspend_date:                 "suspendDate",
  resume_date:                  "resumeDate",
  // Duration & float fields
  target_drtn_hr_cnt:           "duration",
  total_drtn_hr_cnt:            "duration",
  act_drtn_hr_cnt:              "duration",
  remain_drtn_hr_cnt:           "remainDur",
  total_float_hr_cnt:           "float",
  free_float_hr_cnt:            "freeFloat",
  // Percent
  phys_complete_pct:            "pct",
  sched_complete_pct:           "pct",
  // Baseline dates (primary/secondary/target)
  primary_base_start_date:      "blStart",
  primary_base_end_date:        "blEnd",
  secondary_base_start_date:    "blStart",
  secondary_base_end_date:      "blEnd",
  base_start_date:              "blStart",
  base_end_date:                "blEnd",
  target_start_date2:           "blStart",
  target_end_date2:             "blEnd",
  // Type / status
  status_code:                  "statusCode",
  task_type:                    "type",
  // Resources
  rsrc_id:                      "primaryResource",
  // Constraint
  cstr_type:                    "constraintType",
  cstr_type2:                   "constraintType2",
  // Duration type
  duration_type:                "durationType",
  complete_pct_type:            "completePctType",
  priority_type:                "priorityType",
  // Location
  location_id:                  "locationId",
  // Flags
  driving_path_flag:            "drivingPathFlag",
  lock_plan_flag:               "lockPlanFlag",
  auto_compute_act_flag:        "autoComputeActFlag",
  // Units
  est_wt:                       "estWt",
  act_work_qty:                 "actLaborUnits",
  act_equip_qty:                "actNonlaborUnits",
  remain_work_qty:              "remLaborUnits",
  remain_equip_qty:             "remNonlaborUnits",
  target_work_qty:              "planLaborUnits",
  target_equip_qty:             "planNonlaborUnits",
  // Review
  review_end_date:              "reviewFinish",
  review_type:                  "reviewStatus",
  // External / remaining
  external_early_start_date:    "externalEarlyStart",
  external_late_end_date:       "externalLateFinish",
  rem_late_start_date:          "remLateStart",
  rem_late_end_date:            "remLateFinish",
  // Float path
  float_path:                   "floatPath",
  float_path_order:             "floatPathOrder",
  // GUID / IDs
  guid:                         "p6Guid",
  task_id:                      "p6TaskId",
  // User fields
  user_field_1668:              "activity",
  user_field_818:               "activity",
  // Calendar
  clndr_id:                     "activity",
  // Relationship lists
  pred_list:                    "link",
  succ_list:                    "link",
  pred_details:                 "link",
  succ_details:                 "link",
  // Late end date (used in HSK PLF for "Countdown Deadline")
  late_end_date:                "lateEnd",
};

// ── Known attribute keys for S-expression attr parsing ────────────────────
const ATTR_KEYS = [
  "width", "column_title", "alignment", "title_edited", "show_line_number",
  "selected_column", "left", "top", "height", "color", "size", "font_name",
  "back_color", "style", "row_height", "source_field", "show_total",
  "shrink_vertical_bands", "show_group_totals", "hide_base_groupby",
  "join_path", "groupby_type", "show_code_value", "include_all", "summary_pos",
  "alternate_sort_enabled", "sort_type", "max_level", "include_parents",
  "display", "hide", "show_collapsed", "neck_for_calendar_nonwork",
  "neck_for_activity_nonwork", "summary", "row_position", "shape",
  "brush_style", "border_color", "start_source_field", "end_source_field",
  "use_title", "custom", "show_title", "diag_template_index",
  "activate_from_preview", "line_count", "combined_mode", "pixels_per_week",
  "major_date_unit", "minor_date_unit", "date_scale", "date_offset_type",
  "ordinal_start_date", "ordinal_unit", "timescale_color", "timescale_font",
  "timescale_font_size", "timescale_font_style", "timescale_font_color",
  "start_date", "last_start_date", "shift_id", "disable_tree", "layout_type",
  "percent_x", "position_x", "position_y", "active_tab", "show_task_name",
  "show_bottom", "option_bar_pos_x", "CharSet", "table_name",
  "filter_name", "filter_id", "op", "arg1", "arg2", "bool_and", "bool_or",
  "view_name", "view_id", "view_type", "app_name", "user_id", "product_id",
];
// Sort longest first so "column_title" matches before "title"
const SORTED_ATTR_KEYS = [...ATTR_KEYS].sort((a, b) => b.length - a.length);

// ── P6 Baseline source field → our key ──────────────────────────────────
const P6_BASELINE_SOURCE_TO_KEY = {
  primary_base_start_date:      "blStart",
  primary_base_end_date:        "blEnd",
  secondary_base_start_date:    "blStart",
  secondary_base_end_date:      "blEnd",
  base_start_date:              "blStart",
  base_end_date:                "blEnd",
  target_start_date:            "blStart",
  target_end_date:              "blEnd",
};

// ══════════════════════════════════════════════════════════════════════════
//  BUILD (export to our custom XML)
// ══════════════════════════════════════════════════════════════════════════

export function buildPLF(columnVisibility, cw) {
  // Only save VISIBLE columns — the PLF represents the actual displayed layout
  const cols = Object.entries(columnVisibility)
    .filter(([, cfg]) => cfg.visible !== false)
    .sort(([,a],[,b]) => a.position - b.position);

  const colXml = cols.map(([key, cfg]) => {
    const title = KEY_TO_TITLE[key] || key;
    const width = cw[key] ?? 60;
    return `  <Column title="${title}" visible="${cfg.visible}" width="${width}" position="${cfg.position}" />`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<Layout type="Activity">\n${colXml}\n</Layout>`;
}

// ══════════════════════════════════════════════════════════════════════════
//  PARSE (main entry)
// ══════════════════════════════════════════════════════════════════════════

export function parsePLF(text) {
  if (!text || !text.trim()) return null;

  // Try custom XML format first
  const xmlResult = parseXMLFormat(text);
  if (xmlResult) return xmlResult;

  // Detect P6 format variant
  if (text.includes("||")) return parseP6PipeFormat(text);
  return parseP6SExpression(text);
}

// ══════════════════════════════════════════════════════════════════════════
//  PARSER 1: Our custom XML
// ══════════════════════════════════════════════════════════════════════════

function parseXMLFormat(text) {
  try {
    if (!text.includes("<Layout") && !text.includes("<Column")) return null;
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) return null;

    const nodes = Array.from(doc.querySelectorAll("Column"));
    if (!nodes.length) return null;

    const columnVisibility = {};
    const cw = {};

    nodes.forEach(node => {
      const title    = node.getAttribute("title") || "";
      const visible  = node.getAttribute("visible") !== "false";
      const width    = parseInt(node.getAttribute("width") || "60", 10);
      const position = parseInt(node.getAttribute("position") || "0", 10);
      const key = TITLE_TO_KEY[title];
      if (!key) return;
      columnVisibility[key] = { visible, position };
      cw[key] = isNaN(width) ? 60 : width;
    });

    if (!Object.keys(columnVisibility).length) return null;
    return { columnVisibility, cw };
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  PARSER 2: P6 pipe-delimited format (||)
// ══════════════════════════════════════════════════════════════════════════

function parseP6PipeFormat(text) {
  try {
    const colRegex = /\(\d+\|\|([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]*(?:\(\))*)\)/g;
    const columnVisibility = {};
    const cw = {};
    let position = 0;

    let m;
    while ((m = colRegex.exec(text)) !== null) {
      const fieldId = m[1].toLowerCase();
      const attrStr = m[2];
      const widthMatch = attrStr.match(/(?:^|\|)width\|(\d+)/);
      const width = widthMatch ? parseInt(widthMatch[1], 10) : 80;
      const key = P6_FIELD_TO_KEY[fieldId];
      if (key && !columnVisibility[key]) {
        columnVisibility[key] = { visible: true, position };
        cw[key] = Math.min(width, 400);
        position++;
      }
    }

    // Baseline records
    const baselineRegex = /\|\|Baseline\(([^)]+)\)/g;
    let bm;
    while ((bm = baselineRegex.exec(text)) !== null) {
      const attrs = parsePipeKV(bm[1]);
      if ((attrs.hide || "").toUpperCase() === "Y") continue;
      const startKey = P6_BASELINE_SOURCE_TO_KEY[(attrs.start_source_field || "").toLowerCase()];
      const endKey   = P6_BASELINE_SOURCE_TO_KEY[(attrs.end_source_field   || "").toLowerCase()];
      if (startKey && !columnVisibility[startKey]) {
        columnVisibility[startKey] = { visible: true, position: position++ };
        cw[startKey] = 100;
      }
      if (endKey && !columnVisibility[endKey]) {
        columnVisibility[endKey] = { visible: true, position: position++ };
        cw[endKey] = 100;
      }
    }

    if (!Object.keys(columnVisibility).length) return null;
    return { columnVisibility, cw };
  } catch {
    return null;
  }
}

function parsePipeKV(str) {
  const parts = str.split("|");
  const obj = {};
  for (let i = 0; i + 1 < parts.length; i += 2) {
    obj[parts[i].trim()] = parts[i + 1].trim();
  }
  return obj;
}

// ══════════════════════════════════════════════════════════════════════════
//  PARSER 3: P6 S-expression format (HSK / native Oracle export)
// ══════════════════════════════════════════════════════════════════════════
//
// Format:
//   (0TaskView()((0Columns(selected_column1 left664 ...)(
//     (0task_code(width165 column_titleP6. ID title_editedY)())
//     (0task_name(width660 column_titleActivity Name)())
//     ...
//   ))))
//
// Strategy: tokenize the S-expression, build a lightweight tree, then
// walk to find the Columns node and extract its children.

function parseP6SExpression(text) {
  try {
    // Quick check: this format has no || and is a big S-expression
    if (!text.trim().startsWith("(")) return null;

    // ── Method A: direct regex extraction of column entries ─────────────
    // Pattern: (0fieldName(attrs_without_nested_parens)())
    const colRegex = /\(0([a-zA-Z_][a-zA-Z0-9_]*)\(([^()]*(?:\(\))*)\)\(\)\)/g;
    const columnVisibility = {};
    const cw = {};
    let position = 0;

    let m;
    while ((m = colRegex.exec(text)) !== null) {
      const fieldId = m[1].toLowerCase();
      const attrStr = m[2];
      const key = P6_FIELD_TO_KEY[fieldId];
      if (!key) continue;

      const attrs = parseSexprAttrs(attrStr);
      const width = attrs.width ? parseInt(attrs.width, 10) : 80;

      if (!columnVisibility[key]) {
        columnVisibility[key] = { visible: true, position };
        cw[key] = Math.min(isNaN(width) ? 80 : width, 600);
        position++;
      }
    }

    // ── Method B: if regex found nothing, try full tree parse ───────────
    if (!Object.keys(columnVisibility).length) {
      return parseP6SExpressionTree(text);
    }

    // ── Also check baseline records ────────────────────────────────────
    extractBaselinesFromSexpr(text, columnVisibility, cw, position);

    // ── Also extract filter definitions ───────────────────────────────
    let filters = extractFiltersFromSexpr(text);

    return Object.keys(columnVisibility).length
      ? { columnVisibility, cw, ...(filters ? { filters } : {}) }
      : null;
  } catch {
    return null;
  }
}

// Full tree-based S-expression parser (fallback for complex files)
function parseP6SExpressionTree(text) {
  const tokens = tokenize(text);
  if (!tokens.length) return null;

  let idx = 0;
  const root = parseNode(tokens, idx);
  if (!root) return null;

  // Find the TaskView → Columns path
  const columnVisibility = {};
  const cw = {};
  let position = 0;

  function walk(node) {
    if (!node) return;
    // Look for Columns node within TaskView context
    if (node.name === "Columns" || node.name === "TaskColumns") {
      for (const child of node.children) {
        const fieldId = child.name.toLowerCase();
        const key = P6_FIELD_TO_KEY[fieldId];
        if (!key) continue;
        const attrs = child.attrs;
        const width = attrs.width ? parseInt(attrs.width, 10) : 80;
        if (!columnVisibility[key]) {
          columnVisibility[key] = { visible: true, position };
          cw[key] = Math.min(isNaN(width) ? 80 : width, 600);
          position++;
        }
      }
    }
    // Recurse
    for (const child of node.children) walk(child);
  }

  walk(root);

  if (!Object.keys(columnVisibility).length) return null;
  const filters = extractFiltersFromSexpr(text);
  return { columnVisibility, cw, ...(filters ? { filters } : {}) };
}

// ── S-expression tokenizer ───────────────────────────────────────────────

function tokenize(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '(' || ch === ')') {
      tokens.push(ch);
      i++;
    } else if (/\s/.test(ch)) {
      i++;
    } else {
      // Read a token (stops at whitespace or paren)
      let j = i;
      while (j < text.length && !/\s/.test(text[j]) && text[j] !== '(' && text[j] !== ')') j++;
      tokens.push(text.slice(i, j));
      i = j;
    }
  }
  return tokens;
}

// Lightweight S-expression node: { name, attrs, children }
function parseNode(tokens, startIdx) {
  let idx = startIdx;
  if (idx >= tokens.length || tokens[idx] !== '(') return null;
  idx++; // skip '('

  const typeId = tokens[idx];
  if (!typeId || !/^\d+$/.test(typeId)) {
    // No numeric type ID — this is a child list container like ((child1)(child2))
    // Return a synthetic wrapper
    const children = [];
    while (idx < tokens.length && tokens[idx] !== ')') {
      if (tokens[idx] === '(') {
        const child = parseNode(tokens, idx);
        if (child) { children.push(child); idx = child._endIdx; }
        else idx++;
      } else {
        idx++;
      }
    }
    const node = { name: "#list", attrs: {}, children, _endIdx: idx < tokens.length ? idx + 1 : idx };
    return node;
  }
  idx++; // skip typeId

  const name = tokens[idx];
  if (!name) return null;
  idx++; // skip name

  // Parse attributes: tokens until we hit '(' or ')'
  const attrs = {};
  while (idx < tokens.length && tokens[idx] !== '(' && tokens[idx] !== ')') {
    const key = tokens[idx++];
    // Next token is value if it doesn't look like another key
    if (idx < tokens.length && tokens[idx] !== '(' && tokens[idx] !== ')') {
      const maybeVal = tokens[idx];
      // Heuristic: if it starts with uppercase or is a number or known value → it's the value
      if (/^[A-Z0-9]/.test(maybeVal) || SORTED_ATTR_KEYS.indexOf(maybeVal) < 0) {
        attrs[key] = maybeVal;
        idx++;
      } else {
        // It's the next key → this key has no value (boolean flag)
        attrs[key] = "Y";
      }
    } else {
      attrs[key] = "Y";
    }
  }

  // Parse children
  const children = [];
  while (idx < tokens.length && tokens[idx] !== ')') {
    if (tokens[idx] === '(') {
      const child = parseNode(tokens, idx);
      if (child) { children.push(child); idx = child._endIdx; }
      else idx++;
    } else {
      idx++;
    }
  }

  const node = { name, attrs, children, _endIdx: idx < tokens.length ? idx + 1 : idx };
  return node;
}

// ── S-expression attribute parser (regex-free for flat attrs) ──────────

function parseSexprAttrs(attrStr) {
  const result = {};
  let remaining = attrStr.trim();
  if (!remaining) return result;

  // First, try to find known attribute keys
  while (remaining.length > 0) {
    let matched = false;
    for (const key of SORTED_ATTR_KEYS) {
      if (remaining.startsWith(key)) {
        remaining = remaining.slice(key.length);
        // Read value until the next known key or end
        let valEnd = remaining.length;
        for (const k2 of SORTED_ATTR_KEYS) {
          const idx = remaining.indexOf(k2);
          if (idx >= 0 && idx < valEnd) valEnd = idx;
        }
        let val = remaining.slice(0, valEnd);
        // If value is empty, it's a boolean flag
        if (!val) val = "Y";
        result[key] = val;
        remaining = remaining.slice(valEnd);
        matched = true;
        break;
      }
    }
    if (!matched) break;
  }

  return result;
}

// ── P6 filter operator codes → our operator strings ────────────────────
const P6_OP_MAP = {
  0:  "equals",
  1:  "not equals",
  2:  "greater than",
  3:  "greater or equal",
  4:  "less than",
  5:  "less or equal",
  6:  "contains",
  7:  "not contains",
  8:  "between",
  9:  "is empty",
  10: "is not empty",
  11: "starts with",
};

// ── Field mapping for filter parsing ────────────────────────────────
const FILTER_FIELD_MAP = {
  task_code:              { key: "activityId",     type: "text" },
  task_name:              { key: "activity",       type: "text" },
  wbs_id:                 { key: "activityId",     type: "text" },
  start_date:             { key: "start",           type: "date" },
  end_date:               { key: "end",             type: "date" },
  early_start_date:       { key: "earlyStart",      type: "date" },
  early_end_date:         { key: "earlyEnd",        type: "date" },
  late_start_date:        { key: "lateStart",       type: "date" },
  late_end_date:          { key: "lateEnd",         type: "date" },
  expect_end_date:        { key: "expectedFinish",  type: "date" },
  remain_drtn_hr_cnt:     { key: "remainDur",       type: "number" },
  total_float_hr_cnt:     { key: "float",           type: "number" },
  free_float_hr_cnt:      { key: "freeFloat",       type: "number" },
  phys_complete_pct:      { key: "pct",             type: "number" },
  sched_complete_pct:     { key: "pct",             type: "number" },
  status_code:            { key: "statusCode",      type: "text" },
  rsrc_id:                { key: "primaryResource", type: "text" },
  duration_type:          { key: "durationType",    type: "text" },
  complete_pct_type:      { key: "completePctType", type: "text" },
  cstr_type:              { key: "constraintType",  type: "text" },
  cstr_type2:             { key: "constraintType2", type: "text" },
  priority_type:          { key: "priorityType",    type: "text" },
  location_id:            { key: "locationId",      type: "text" },
  driving_path_flag:      { key: "drivingPathFlag", type: "text" },
  target_drtn_hr_cnt:     { key: "targetDuration",  type: "number" },
  est_wt:                 { key: "estWt",           type: "number" },
  guid:                   { key: "p6Guid",          type: "text" },
  task_type:              { key: "barType",         type: "text" },
  primary_base_start_date:{ key: "baselineStart",   type: "date" },
  primary_base_end_date:  { key: "baselineFinish",  type: "date" },
  lock_plan_flag:         { key: "lockPlanFlag",     type: "text" },
  auto_compute_act_flag:  { key: "autoComputeActFlag", type: "text" },
  float_path:             { key: "floatPath",       type: "text" },
  float_path_order:       { key: "floatPathOrder",  type: "number" },
};

// ── Filter extraction from S-expression format (tree-based) ─────────

function extractFiltersFromSexpr(text) {
  try {
    // Find all Filter blocks with a regex that captures the full S-expression body
    // Pattern: (0Filter(attrs)(body)) where body contains nested parens
    const filterRegex = /\(0Filter\(([^)]*(?:\([^)]*\)[^)]*)*)\)\(((?:[^()]|\([^()]*\))*)\)\)/g;
    const filterGroups = [];

    let fm;
    while ((fm = filterRegex.exec(text)) !== null) {
      const attrsStr = fm[1];
      const bodyStr = fm[2];

      // Parse the boolean tree body using nested regex
      const group = parseFilterTree(bodyStr);
      if (group && (group.conditions.length > 0 || group.groups.length > 0)) {
        filterGroups.push(group);
      }
    }

    if (!filterGroups.length) return null;
    return filterGroups[0];
  } catch {
    return null;
  }
}

// Parse a filter boolean tree body — handles nested bool_and/bool_or
function parseFilterTree(body) {
  // Top-level: (0bool_and()(content...)) or (0bool_or()(content...))
  const topMatch = body.match(/\(0(bool_and|bool_or)\(\)\(([\s\S]*)\)\)\)/);
  if (!topMatch) return { logic: "all", conditions: [], groups: [] };

  const logic = topMatch[1] === "bool_or" ? "any" : "all";
  const content = topMatch[2];

  // Split content into children: FilterParam nodes and nested bool groups
  // FilterParam: (0FilterParam(attrs)())
  // Nested bool: (0bool_and/or()(content...))()

  return parseGroupContent(content, logic);
}

function parseGroupContent(content, logic) {
  const group = { logic, conditions: [], groups: [] };
  let remaining = content;

  // Extract FilterParam entries: (0FilterParam(attrs)())
  const paramRegex = /\(0FilterParam\(([^)]*(?:\(\))*)\)\(\)\)/g;
  let pm;
  while ((pm = paramRegex.exec(content)) !== null) {
    const cond = parseFilterParamRaw(pm[1]);
    if (cond) group.conditions.push(cond);
  }

  // Extract nested bool_and/bool_or groups
  // These look like: (0bool_and()(inner...)())
  const nestedRegex = /\(0(bool_and|bool_or)\(\)\(([\s\S]*?)\)\)\)/g;
  // Find sub-groups that are DIRECT children (not inside another bool group)
  let nestedContent = content;
  // Remove already-matched FilterParams to isolate nested groups
  nestedContent = nestedContent.replace(paramRegex, "");
  
  let nm;
  while ((nm = nestedRegex.exec(nestedContent)) !== null) {
    const subLogic = nm[1] === "bool_or" ? "any" : "all";
    const subContent = nm[2];
    const sub = parseGroupContent(subContent, subLogic);
    if (sub && (sub.conditions.length > 0 || sub.groups.length > 0)) {
      group.groups.push(sub);
    }
  }

  return group;
}

function parseFilterParamRaw(raw) {
  // Parse attrs from a raw string like: field_name task_code op 0 arg1 C2-C3-AHR-1000
  // Values may contain spaces within quotes: field_name"Some Name"
  const result = {};
  
  // Join quoted strings: replace "word1 word2" with word1_word2 placeholder
  let cleaned = raw;
  const quotedParts = [];
  cleaned = cleaned.replace(/"([^"]*)"/g, (match, inner) => {
    const placeholder = `__QUOTED${quotedParts.length}__`;
    quotedParts.push(inner);
    return placeholder;
  });

  const tokens = cleaned.trim().split(/\s+/);
  let i = 0;
  while (i < tokens.length) {
    const key = tokens[i];
    if (key === "field_name") {
      if (i + 1 < tokens.length) {
        let val = tokens[++i];
        // Restore quoted value if placeholder
        const qm = val.match(/^__QUOTED(\d+)__$/);
        if (qm) val = quotedParts[parseInt(qm[1])];
        result.field_name = val;
      }
    } else if (key === "op") {
      if (i + 1 < tokens.length) {
        const code = parseInt(tokens[++i], 10);
        result.operator = P6_OP_MAP[code] || "equals";
      }
    } else if (key === "arg1") {
      if (i + 1 < tokens.length) {
        let val = tokens[++i];
        const qm = val.match(/^__QUOTED(\d+)__$/);
        if (qm) val = quotedParts[parseInt(qm[1])];
        result.arg1 = val;
      }
    } else if (key === "arg2") {
      if (i + 1 < tokens.length) {
        let val = tokens[++i];
        const qm = val.match(/^__QUOTED(\d+)__$/);
        if (qm) val = quotedParts[parseInt(qm[1])];
        result.arg2 = val;
      }
    }
    i++;
  }

  if (!result.field_name) return null;

  const fieldDef = FILTER_FIELD_MAP[result.field_name];
  if (!fieldDef) return null;

  return {
    field: fieldDef.key,
    operator: result.operator || "equals",
    value: result.arg1 != null ? String(result.arg1) : "",
    value2: result.arg2 != null ? String(result.arg2) : "",
  };
}

// ── Baseline extraction from S-expression format ──────────────────────

function extractBaselinesFromSexpr(text, columnVisibility, cw, startPos) {
  let position = startPos;
  // Find Baseline(...) records
  const baseRegex = /\(0([A-Za-z][A-Za-z0-9_ ]*Baseline)\(([^)]*)\)/g;
  let bm;
  while ((bm = baseRegex.exec(text)) !== null) {
    const attrStr = bm[2];
    const attrs = parseSexprAttrs(attrStr);
    if ((attrs.hide || "").toUpperCase() === "Y") continue;

    const startKey = P6_BASELINE_SOURCE_TO_KEY[(attrs.start_source_field || "").toLowerCase()];
    const endKey   = P6_BASELINE_SOURCE_TO_KEY[(attrs.end_source_field   || "").toLowerCase()];

    if (startKey && !columnVisibility[startKey]) {
      columnVisibility[startKey] = { visible: true, position: position++ };
      if (!cw[startKey]) cw[startKey] = 100;
    }
    if (endKey && !columnVisibility[endKey]) {
      columnVisibility[endKey] = { visible: true, position: position++ };
      if (!cw[endKey]) cw[endKey] = 100;
    }
  }
}