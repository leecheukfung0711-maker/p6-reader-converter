/**
 * Shared XER field mapping persistence helpers.
 * Used by both XerMappingDialog and FieldMappingTool.
 */

const STORAGE_KEY = "gantt_xer_mapping_v1";

export const DEFAULT_MAPPING = {
  task_code:            "activityId",
  task_name:            "activity",
  wbs_name:             "sectionActivity",
  task_code_prefix:     "",
  task_code_fallback:   "auto",
  date_source:          "startEnd",
  skip_no_dates:        true,
  skip_sections:        false,
  wbs_short_name_mode:  "ascii_truncate",
  duration_unit:        "hours8",
};

export function loadMapping() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? { ...DEFAULT_MAPPING, ...JSON.parse(s) } : { ...DEFAULT_MAPPING };
  } catch {
    return { ...DEFAULT_MAPPING };
  }
}

export function saveMapping(m) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {}
}