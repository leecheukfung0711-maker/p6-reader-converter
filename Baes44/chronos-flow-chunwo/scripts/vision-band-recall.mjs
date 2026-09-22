/**
 * Vision recall test: whole-page call vs the same page split into horizontal
 * bands. Dense P6 programme prints lose rows in a single whole-page vision call
 * (and *which* rows are lost changes between runs), so this measures whether
 * chunking recovers them.
 *
 *   node scripts/vision-band-recall.mjs <part1.jpg> [part2.jpg ...] [--prefix p]
 *
 * Uses the app's own prompt (GANTT_PROMPT_BASE + GANTT_VISION_PROMPT_SUFFIX) and
 * the 18-field vision schema, so the numbers are directly comparable with what
 * the app does today. Each part costs 1 upload + 1 LLM call.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const APP_ID = "6a38f8c8aae6ce8a8b2b1096";
const API = `http://localhost:15156/api/apps/${APP_ID}/integration-endpoints/Core`;
const MODEL = "gemini_3_1_pro";

const argv = process.argv.slice(2);
const prefixIdx = argv.indexOf("--prefix");
const prefix = prefixIdx >= 0 ? argv[prefixIdx + 1] : "bands";
const parts = argv.filter((a, i) => !a.startsWith("--") && i !== prefixIdx + 1);
if (!parts.length) { console.error("usage: node scripts/vision-band-recall.mjs <part.jpg> [...] [--prefix p]"); process.exit(2); }

const src = readFileSync("src/components/gantt/ImageImportDialog.jsx", "utf8");
const promptBase = src.match(/const GANTT_PROMPT_BASE = `([\s\S]*?)`;/)?.[1];
const visionSuffix = src.match(/const GANTT_VISION_PROMPT_SUFFIX = `([\s\S]*?)`;/)?.[1] || "";
if (!promptBase) { console.error("run this from the app root (Baes44/chronos-flow-chunwo)"); process.exit(2); }

const PART_NOTE = (name, i, n) => `\n\nThis image is PART ${i + 1} of ${n} of the same programme page, cut horizontally (file: ${basename(name)}).\nIt may start and end in the middle of a row: still extract every row you can see, even partial ones.\nThe image has been pre-rotated to the correct reading orientation — read left-to-right, top-to-bottom.`;

const BASE_FIELDS = {
  is_section: { type: "boolean" }, section_type: { type: "string" }, activity_id: { type: "string" },
  activity: { type: "string" }, item: { type: "string" }, start: { type: "string" }, end: { type: "string" },
  baseline_start: { type: "string" }, baseline_finish: { type: "string" }, bar_type: { type: "string" },
  start_actual: { type: "boolean" }, end_actual: { type: "boolean" }, remain_dur: { type: "number" },
  float: { type: "number" }, pct: { type: "number" }, driving_path_flag: { type: "string" },
  section_level: { type: "number" }, section_color: { type: "string" },
};
const SCHEMA = {
  type: "object",
  properties: { tasks: { type: "array", items: { type: "object", properties: BASE_FIELDS } } },
};

const keyOf = (t) => (t.activity_id || "").trim().toLowerCase()
  || `${(t.activity || "").trim().toLowerCase()}|${t.start || ""}|${t.end || ""}`;

async function uploadImage(path) {
  const fd = new FormData();
  fd.append("file", new Blob([readFileSync(path)], { type: "image/jpeg" }), basename(path));
  const res = await fetch(`${API}/UploadFile`, { method: "POST", body: fd });
  const text = await res.text();
  if (!res.ok) throw new Error(`UploadFile ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function invokeLLM(prompt, fileUrl) {
  const res = await fetch(`${API}/InvokeLLM`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, file_urls: [fileUrl], response_json_schema: SCHEMA, model: MODEL }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`InvokeLLM ${res.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return text; }
}

const seen = new Map();          // key → {source, row}
const perPart = [];
for (let i = 0; i < parts.length; i += 1) {
  const path = parts[i];
  const t0 = Date.now();
  let tasks = [], error = null;
  try {
    const up = await uploadImage(path);
    const fileUrl = up.file_url || up.url || up.data?.file_url;
    if (!fileUrl) throw new Error(`no file_url: ${JSON.stringify(up).slice(0, 120)}`);
    const result = await invokeLLM(promptBase + visionSuffix + PART_NOTE(path, i, parts.length), fileUrl);
    tasks = Array.isArray(result?.tasks) ? result.tasks : [];
    writeFileSync(join(tmpdir(), `${prefix}-part${i + 1}.json`), JSON.stringify({ part: basename(path), ms: Date.now() - t0, result }, null, 2), "utf8");
  } catch (e) { error = String(e.message || e); }
  const fresh = [];
  tasks.forEach((t) => {
    const k = keyOf(t);
    if (!seen.has(k)) { seen.set(k, { source: i + 1, row: t }); fresh.push(t); }
  });
  const sections = tasks.filter((t) => t && t.is_section).length;
  perPart.push({ part: i + 1, file: basename(path), rows: tasks.length, sections, new: fresh.length, seconds: ((Date.now() - t0) / 1000).toFixed(1), error: error || "" });
  console.log(`[part ${i + 1}/${parts.length}] ${basename(path)} rows=${tasks.length} (sections ${sections}) new=${fresh.length} ${perPart[i].seconds}s ${error ? "ERROR: " + error : ""}`);
}

const merged = [...seen.values()].map((v) => ({ ...v.row, __part: v.source }));
const totalRaw = perPart.reduce((a, p) => a + p.rows, 0);
writeFileSync(join(tmpdir(), `${prefix}-merged.json`), JSON.stringify({ parts: perPart, merged }, null, 2), "utf8");
console.log("\n=== RESULT ===");
console.table(perPart);
console.log(`rows returned in total: ${totalRaw}  |  duplicates removed (band overlap): ${totalRaw - merged.length}  |  UNION (unique rows): ${merged.length}`);
console.log(`sections in union: ${merged.filter((r) => r.is_section).length}`);
console.log(`\nraw: ${join(tmpdir(), `${prefix}-merged.json`)}`);
