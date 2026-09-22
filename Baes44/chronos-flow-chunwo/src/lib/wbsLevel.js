/**
 * WBS level helpers (batch 23A / 23C).
 *
 * `sectionLevel` already drives the 7-step WBS colour scheme, the "Customise
 * Grouping → To Level" filter and the level statistics. What was missing:
 *   · non-XER imports (Excel / PDF / scanned OCR) created every section as
 *     Level 1, so a whole programme looked flat;
 *   · there was no way to correct a level by hand.
 *
 * This module adds the deterministic half (no AI, no DOM):
 *   levelFromTitle()     — read the hierarchy straight off the WBS numbering
 *   inferSectionLevels() — apply it to an imported task list (never overwrites
 *                          levels that came from the XER PROJWBS hierarchy)
 *   wbsIndentPx()        — the per-level text indent used by the Gantt/table
 */
import { WBS_LEVEL_COUNT } from "@/lib/displaySettings";

export { WBS_LEVEL_COUNT };

/** Keep a level inside the 7 schemes the panel offers (1 = top). */
export function clampWbsLevel(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(n, 1), WBS_LEVEL_COUNT);
}

/** Full-width digits (１２３) → half-width, so Chinese documents parse too. */
const toHalfWidth = (s) => s.replace(/[\uFF10-\uFF19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

/**
 * Leading WBS code: `1`, `1.1`, `1.1.1`, `1.0`, `A`, `A.1`, `CW.1.1`, Chinese
 * `2)`, `3.` … A delimiter (or end of string) must follow, so ordinary titles
 * such as "Contract No. DC/2023/08" are not mistaken for a hierarchy code.
 */
const CODE_RE = /^\s*(?:第\s*)?(\d+(?:\.\d+)*|[A-Za-z](?:\.\d+)*|[A-Za-z]{2,4}(?:\.\d+)+)\s*(?:[.)\uFF09\u3001,\uFF0C:\uFF1A\-–—\u7AE0\u7BC0\u7BC7\u90E8\u9805]|\s|$)/;

/**
 * Level encoded in a section title — 0 when there is no numbering to trust.
 * Trailing zero segments are dropped, so the P6 "1.0 / 1.1 / 1.1.1" style maps
 * to 1 / 2 / 3.
 */
export function levelFromTitle(title) {
  const text = toHalfWidth(String(title ?? ""));
  const m = text.match(CODE_RE);
  if (!m) return 0;
  const parts = m[1].split(".").filter(Boolean);
  while (parts.length > 1 && /^0+$/.test(parts[parts.length - 1])) parts.pop();
  return clampWbsLevel(parts.length);
}

/**
 * Fill in `sectionLevel` for sections that do not have one yet.
 *
 * Priority (batch 23B): the deterministic WBS numbering in the title always
 * wins; when a title carries no code, the vision model's `section_level` hint
 * (`aiSectionLevel`) is used; otherwise the section stays at Level 1 — never
 * guessed. Levels that already exist (XER `PROJWBS`) are kept untouched.
 *
 * @param tasks      imported task list
 * @param overwrite  re-derive even when a level already exists
 * @returns {{tasks: Array, stats: {sections:number, fromTitle:number, fromAi:number,
 *            inferred:number, kept:number, unresolved:number, byLevel:Object, maxLevel:number}}}
 */
export function inferSectionLevels(tasks, { overwrite = false } = {}) {
  const stats = {
    sections: 0, fromTitle: 0, fromAi: 0, inferred: 0, kept: 0, unresolved: 0,
    byLevel: {}, maxLevel: 1,
  };
  const list = Array.isArray(tasks) ? tasks : [];
  const next = list.map((t) => {
    if (!t || !t.isSection) return t;
    stats.sections += 1;
    const existing = Number(t.sectionLevel) || 0;
    if (!overwrite && existing > 0) {
      stats.kept += 1;
      stats.byLevel[existing] = (stats.byLevel[existing] || 0) + 1;
      stats.maxLevel = Math.max(stats.maxLevel, existing);
      return t;
    }
    const fromTitle = levelFromTitle(t.activity);
    const fromAi = fromTitle ? 0 : clampWbsLevel(t.aiSectionLevel);
    const level = fromTitle || (Number(t.aiSectionLevel) ? fromAi : 0);
    if (!level) {
      stats.unresolved += 1;
      return t;                       // recognisable signal only — never guess
    }
    if (fromTitle) stats.fromTitle += 1; else stats.fromAi += 1;
    stats.inferred += 1;
    stats.byLevel[level] = (stats.byLevel[level] || 0) + 1;
    stats.maxLevel = Math.max(stats.maxLevel, level);
    return { ...t, sectionLevel: level };
  });
  return { tasks: next, stats };
}

/** Human-readable one-liner for the import report, e.g. "L1 3 ／ L2 6 ／ L3 3". */
export function levelStatsLabel(stats) {
  const parts = Object.keys(stats?.byLevel || {})
    .map(Number)
    .sort((a, b) => a - b)
    .map((l) => `L${l} ${stats.byLevel[l]}`);
  return parts.join(" ／ ");
}

/**
 * Text indent (px) for a WBS row: the global group indent plus one step per level.
 * `indentByLevel === false` keeps the pre-batch-23 look (level colours only).
 */
export const WBS_INDENT_STEP = 12;
export function wbsIndentPx(level, baseIndent = 0, indentByLevel = true) {
  const step = indentByLevel === false ? 0 : (clampWbsLevel(level) - 1) * WBS_INDENT_STEP;
  return Math.max(0, Number(baseIndent) || 0) + step;
}
