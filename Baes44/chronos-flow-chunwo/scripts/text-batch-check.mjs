/**
 * Send one page-batch of already-extracted PDF text through the same prompt and
 * schema the app's text path uses, and print the row count.
 *
 *   node scripts/text-batch-check.mjs <batch.txt> [label]
 *
 * Batch 24 evidence helper: before the fix the import sent only the first 24 000
 * characters of the document, so a batch like pages 10-12 was never sent at all.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const APP_ID = "6a38f8c8aae6ce8a8b2b1096";
const API = `http://localhost:15156/api/apps/${APP_ID}/integration-endpoints/Core/InvokeLLM`;
const file = process.argv[2];
const label = process.argv[3] || basename(file || "batch");
if (!file) { console.error("usage: node scripts/text-batch-check.mjs <batch.txt> [label]"); process.exit(2); }

const src = readFileSync("src/components/gantt/ImageImportDialog.jsx", "utf8");
const promptBase = src.match(/const GANTT_PROMPT_BASE = `([\s\S]*?)`;/)?.[1];
const schemaBlock = src.match(/const GANTT_TASK_SCHEMA = \{[\s\S]*?\n\};/)?.[0] || "";
const fields = [...schemaBlock.matchAll(/^\s{10}([a-z_0-9]+):\s*\{\s*type:\s*"(\w+)"/gm)].map(([, name, type]) => [name, type]);
if (!promptBase || !fields.length) { console.error("could not read the prompt/schema from ImageImportDialog.jsx"); process.exit(2); }

const schema = {
  type: "object",
  properties: {
    tasks: { type: "array", items: { type: "object", properties: Object.fromEntries(fields.map(([n, t]) => [n, { type: t }])) } },
  },
};
const text = readFileSync(file, "utf8");
const prompt = `${promptBase}\n\nThis is part 4 of 10 of the file "6WSD21-DP_202409.pdf", covering ${label} of 27. ` +
  `Other parts are extracted separately — extract EVERY row that appears in this text, never summarise it.\n\nText content:\n${text}`;

const t0 = Date.now();
const res = await fetch(API, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt, response_json_schema: schema, model: "gemini_3_1_pro" }),
});
const body = await res.text();
const seconds = ((Date.now() - t0) / 1000).toFixed(1);
if (!res.ok) { console.error(`HTTP ${res.status}: ${body.slice(0, 300)}`); process.exit(1); }
const parsed = JSON.parse(body);
const tasks = parsed?.tasks || [];
const sections = tasks.filter((t) => t.is_section);
console.log(`[${label}] ${text.length} chars, ${fields.length}-field schema → ${tasks.length} rows (${sections.length} sections) in ${seconds}s`);
console.log(`first: ${tasks.slice(0, 3).map((t) => `${t.activity_id || "-"} ${String(t.activity || "").slice(0, 34)}`).join(" | ")}`);
