/**
 * A/B harness: does adding vision-schema fields (section_level / section_color)
 * reduce the number of rows the model returns?
 *
 * Batch 6 measured 37 fields -> 3 rows vs 16 fields -> 31 rows, so batch 23B may
 * only touch GANTT_VISION_TASK_SCHEMA after a measurement like this one. Run it
 * from the app root (Baes44/chronos-flow-chunwo) with the dev server up:
 *
 *   node scripts/ab-vision-schema.mjs "<page image>" [outPrefix]
 *
 * The prompt is read verbatim from ImageImportDialog.jsx (`GANTT_PROMPT_BASE`),
 * so the variants differ only in the schema (+ the level/colour rules a real
 * implementation would add). Calls go through the local Vite proxy — the same
 * Base44 endpoint the app uses; each run costs 1 upload + 3 LLM calls.
 *
 * Result 2026-09-21 (real programme page, 2800x1980 q75):
 *   16 fields -> 41 rows, 17 -> 41, 18 -> 41  ⇒ no row loss (see requirements.md)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const APP_ID = "6a38f8c8aae6ce8a8b2b1096";
const API = `http://localhost:15156/api/apps/${APP_ID}/integration-endpoints/Core`;
const MODEL = "gemini_3_1_pro";

const imgPath = process.argv[2];
const prefix = process.argv[3] || "ab";
if (!imgPath) { console.error("usage: node scripts/ab-vision-schema.mjs <image.jpg> [outPrefix]"); process.exit(2); }

const promptSrc = readFileSync("src/components/gantt/ImageImportDialog.jsx", "utf8");
const promptBase = promptSrc.match(/const GANTT_PROMPT_BASE = `([\s\S]*?)`;/)?.[1];
const visionSuffix = promptSrc.match(/const GANTT_VISION_PROMPT_SUFFIX = `([\s\S]*?)`;/)?.[1] || "";
if (!promptBase) { console.error("could not extract GANTT_PROMPT_BASE (run from the app root)"); process.exit(2); }

const PAGE_NOTE = `\n\nThis is a page from file: ${basename(imgPath)}.\nThe image has been pre-rotated to the correct reading orientation — read left-to-right, top-to-bottom.`;

const BASE_FIELDS = {
  is_section: { type: "boolean" }, section_type: { type: "string" }, activity_id: { type: "string" },
  activity: { type: "string" }, item: { type: "string" }, start: { type: "string" }, end: { type: "string" },
  baseline_start: { type: "string" }, baseline_finish: { type: "string" }, bar_type: { type: "string" },
  start_actual: { type: "boolean" }, end_actual: { type: "boolean" }, remain_dur: { type: "number" },
  float: { type: "number" }, pct: { type: "number" }, driving_path_flag: { type: "string" },
};
const schemaOf = (extra) => ({
  type: "object",
  properties: { tasks: { type: "array", items: { type: "object", properties: { ...BASE_FIELDS, ...extra } } } },
});

// Variant 3 mirrors the shipped configuration: the app's own vision prompt
// suffix (GANTT_VISION_PROMPT_SUFFIX) plus the 18-field schema.
const VARIANTS = [
  { id: "16-baseline", fields: 16, schema: schemaOf({}), prompt: promptBase + PAGE_NOTE },
  { id: "17-plus-level", fields: 17, schema: schemaOf({ section_level: { type: "number" } }), prompt: promptBase + visionSuffix + PAGE_NOTE },
  { id: "18-level-colour", fields: 18, schema: schemaOf({ section_level: { type: "number" }, section_color: { type: "string" } }), prompt: promptBase + visionSuffix + PAGE_NOTE },
];

// ── runner ──────────────────────────────────────────────────────────────────
async function uploadImage(path) {
  const fd = new FormData();
  fd.append("file", new Blob([readFileSync(path)], { type: "image/jpeg" }), "page.jpg");
  const res = await fetch(`${API}/UploadFile`, { method: "POST", body: fd });
  const text = await res.text();
  if (!res.ok) throw new Error(`UploadFile ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function invokeLLM(prompt, fileUrl, responseSchema) {
  const res = await fetch(`${API}/InvokeLLM`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, file_urls: [fileUrl], response_json_schema: responseSchema, model: MODEL }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`InvokeLLM ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}

const up = await uploadImage(imgPath);
const fileUrl = up.file_url || up.url || up.data?.file_url;
console.log(`[upload] ${fileUrl}`);
if (!fileUrl) { console.error(`no file_url in upload response: ${JSON.stringify(up).slice(0, 200)}`); process.exit(1); }

const rows = [];
const only = process.argv[4];                        // optional variant filter, e.g. "18"
const selected = only ? VARIANTS.filter((v) => v.id.includes(only)) : VARIANTS;
if (!selected.length) { console.error(`no variant matches "${only}" (${VARIANTS.map((v) => v.id).join(", ")})`); process.exit(2); }
for (const v of selected) {
  const t0 = Date.now();
  let result, error = null;
  try { result = await invokeLLM(v.prompt, fileUrl, v.schema); } catch (e) { error = String(e.message || e); }
  const ms = Date.now() - t0;
  const tasks = Array.isArray(result?.tasks) ? result.tasks : (Array.isArray(result) ? result : []);
  const sections = tasks.filter((t) => t && t.is_section);
  const levelHist = {};
  sections.forEach((s) => { if (s.section_level != null) levelHist[s.section_level] = (levelHist[s.section_level] || 0) + 1; });
  writeFileSync(join(tmpdir(), `${prefix}-${v.id}.json`), JSON.stringify({ variant: v.id, fields: v.fields, ms, error, result }, null, 2), "utf8");
  const row = {
    variant: v.id, fields: v.fields, rows: tasks.length, sections: sections.length,
    activities: tasks.length - sections.length,
    withLevel: sections.filter((s) => s.section_level != null).length,
    withColour: sections.filter((s) => s.section_color).length,
    levels: JSON.stringify(levelHist), seconds: (ms / 1000).toFixed(1), error: error || "",
  };
  rows.push(row);
  console.log(`[${v.id}] fields=${v.fields} rows=${row.rows} (sections ${row.sections} / activities ${row.activities}) withLevel=${row.withLevel} withColour=${row.withColour} ${row.seconds}s ${error ? "ERROR: " + error : ""}`);
}
console.log("\n=== SUMMARY (the row count must stay flat while fields grow) ===");
console.table(rows);
console.log(`\nRaw responses: ${selected.map((v) => join(tmpdir(), `${prefix}-${v.id}.json`)).join(" , ")}`);
