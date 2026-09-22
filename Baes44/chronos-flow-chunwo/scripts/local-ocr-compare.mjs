/**
 * Compare the local OCR engines on ONE image, through the app's own adapters
 * (src/lib/localOcr.js), so the numbers reflect what an import would really get.
 *
 *   node scripts/local-ocr-compare.mjs <page-or-strip.jpg> [--engines ppocr,ollama,pstocr]
 *        [--model ovisocr2:bf] [--timeout 300] [--no-crop]
 *
 * The app crops the left ID column in the browser (canvas); Node cannot, so this
 * script crops the same 22 % strip with the Paddle venv's Pillow when available and
 * otherwise reads the whole image. Results: seconds, lines, activity-id count.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "vite";

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
// The image is the first argument that is neither a flag nor a flag's value.
const consumed = new Set();
["engines", "model", "timeout", "strip"].forEach((name) => {
  const i = argv.indexOf(`--${name}`);
  if (i >= 0) consumed.add(i + 1);
});
const input = argv.find((a, i) => !a.startsWith("--") && !consumed.has(i));
if (!input) { console.error("usage: node scripts/local-ocr-compare.mjs <image> [--engines ppocr,ollama,pstocr] [--model name]"); process.exit(2); }

const wanted = String(flag("engines", "ppocr,ollama,pstocr")).split(",").map((s) => s.trim()).filter(Boolean);
const model = flag("model", "ovisocr2:bf");
const timeoutMs = Number(flag("timeout", "300")) * 1000;
const noCrop = argv.includes("--no-crop");
const PYTHON = "C:\\dev\\paddle-ocr\\.venv\\Scripts\\python.exe";

/** Crop the same left strip the browser crops (22 %), using Pillow. */
function cropStrip(path) {
  if (noCrop || !existsSync(PYTHON)) return path;
  const out = join(tmpdir(), `${basename(path).replace(/\.[^.]+$/, "")}_strip.jpg`);
  try {
    execFileSync(PYTHON, ["-c",
      `from PIL import Image; im=Image.open(r"${path}"); w,h=im.size; im.crop((0,0,int(w*0.22),h)).save(r"${out}","JPEG",quality=85)`,
    ], { stdio: "pipe" });
    return out;
  } catch {
    return path;
  }
}

const stripPath = cropStrip(input);
console.log(`[input] ${basename(stripPath)}${stripPath === input ? "" : ` (left 22 % strip of ${basename(input)})`}`);

// Load the app's adapters through Vite so aliases and browser shims behave the same.
process.env.VITE_STRIP_FREE = "1";
const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
const { LOCAL_OCR_ENGINES, probeLocalOcr, readPageLocally } = await server.ssrLoadModule("/src/lib/localOcr.js");

const bytes = readFileSync(stripPath);
const blob = new Blob([bytes], { type: "image/jpeg" });
console.log(`[image] ${Math.round(bytes.length / 1024)} KB`);

const rows = [];
for (const engine of LOCAL_OCR_ENGINES.filter((e) => wanted.includes(e.id))) {
  const settings = { engine: engine.id, url: engine.defaultUrl, model: engine.useModel ?? model };
  const probe = await probeLocalOcr(settings, 15000);
  if (!probe.available) {
    rows.push({ engine: engine.id, status: "unavailable", seconds: (probe.ms / 1000).toFixed(1), lines: "-", ids: "-", sample: probe.error || "" });
    console.log(`[${engine.id}] unavailable (${probe.ms} ms): ${probe.error}`);
    continue;
  }
  const started = Date.now();
  const read = await readPageLocally(blob, settings, timeoutMs, { strip: false });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const ids = read?.ids || [];
  rows.push({
    engine: engine.id, status: read ? "ok" : "no text", seconds,
    lines: read?.lines?.length ?? 0, ids: ids.length,
    sample: ids.slice(0, 6).map((i) => i.display).join(", "),
  });
  console.log(`[${engine.id}] ${read ? "ok" : "no text"} in ${seconds}s | lines=${read?.lines?.length ?? 0} | ids=${ids.length} | ${ids.slice(0, 6).map((i) => i.display).join(", ")}`);
}

console.table(rows);
writeFileSync(join(tmpdir(), "local-ocr-compare.json"), JSON.stringify(rows, null, 2), "utf8");
console.log(`raw: ${join(tmpdir(), "local-ocr-compare.json")}`);
await server.close();
