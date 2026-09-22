/**
 * Local-OCR cross-check (batch 25).
 *
 * Every scanned page is read twice at the same time:
 *   ① the cloud LLM (Base44, what the app has always used) — good at rows, floats,
 *      bar types, section bands, but it silently drops rows on dense pages;
 *   ② a local OCR engine (PP-OCR HTTP service, `C:\dev\paddle-ocr\ocr_server.py`,
 *      or any endpoint with the same `/health` + `/ocr` shape) — weaker at
 *      structuring, but it sees *every* line, so it is the honest second opinion.
 *
 * When ② shows that ① missed a large share of a page's activity IDs, that page is
 * re-read on its own and the recovered rows are spliced back into the page's
 * position. Nothing here calls the network unless a caller asks it to.
 */

export const LOCAL_OCR_DEFAULT_URL = "http://127.0.0.1:8199";
export const LOCAL_OCR_STORAGE_KEY = "gantt_local_ocr";

/**
 * The local engines this app knows how to talk to. Each one is only an HTTP shape —
 * pick whichever is running on the machine; the cross-check logic is identical.
 */
export const LOCAL_OCR_ENGINES = [
  {
    id: "ppocr",
    label: "PP-OCR service (ocr_server.py)",
    defaultUrl: "http://127.0.0.1:8199",
    needsModel: false,
    hint: "recommended — ID column strip ≈ 35 s/page, ids read cleanly",
  },
  {
    id: "ollama",
    label: "Ollama local model",
    defaultUrl: "http://127.0.0.1:11434",
    needsModel: true,
    hint: "no setup (often already running); CPU inference is slow on dense A3 pages",
  },
  {
    id: "pstocr",
    label: "PST-OCR service (OvisOCR2)",
    defaultUrl: "http://127.0.0.1:7861",
    needsModel: false,
    hint: "start the portable service first; ~1-3 min/page on CPU",
  },
];

export function engineById(id) {
  return LOCAL_OCR_ENGINES.find((engine) => engine.id === id) || LOCAL_OCR_ENGINES[0];
}

/** A page is re-read when at least this share of the locally read IDs is missing. */
export const OCR_MISSING_RATIO = 0.4;
/** …and at least this many IDs (so one noisy token never triggers a re-read). */
export const OCR_MIN_MISSING = 3;
/** …and only when the local engine actually read a meaningful number of IDs. */
export const OCR_MIN_LOCAL_IDS = 5;

/**
 * Fold an activity ID so OCR noise does not break the comparison:
 * uppercase, drop separators, and map the classic confusions (O/0, I/L/1, S/5,
 * B/8, Z/2, G/6, Q/0) to one character.
 */
export function foldOcrId(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/[OQG]/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/[SZ]/g, "5")
    .replace(/B/g, "8");
}

// A P6 activity ID keeps letters, digits and separators together ("WSD-W-ELS-1470",
// "WSD-MiC-1790", "S9-CW0101"); the filters below drop ordinary words and table cells.
const ID_PATTERN = /[A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)*/g;

/** Activity-ID-looking tokens in plain OCR text (folded + de-duplicated). */
export function extractActivityIds(text) {
  const found = new Map();                      // folded → first display form
  const matches = String(text || "").match(ID_PATTERN) || [];
  for (const raw of matches) {
    const display = raw.trim().replace(/\s+/g, "");
    if (!/\d/.test(display)) continue;           // must contain digits to be an ID
    const folded = foldOcrId(display);
    if (folded.length < 4) continue;
    // A P6 activity ID ends in a number ("WSD-W-ELS-1470", "WSD-MiC-1790", "WSD-KD1-11").
    // Requiring a numeric last segment rejects activity-NAME fragments such as
    // "F_MiCZoneJ1a-M1F01B" — phantom ids would otherwise trigger pointless re-reads.
    const parts = display.split(/[-_]/).filter(Boolean);
    if (parts.length < 2 || !/^\d{1,6}[a-z]?$/i.test(parts[parts.length - 1])) continue;
    if (!found.has(folded)) found.set(folded, display);
  }
  return [...found.entries()].map(([folded, display]) => ({ folded, display }));
}

/**
 * Compare what the cloud read against what the local engine saw.
 * @returns {{localCount:number, cloudCount:number, missing:{folded,display}[],
 *            missingRatio:number, needsRerun:boolean, reason:string}}
 */
export function comparePageCoverage(cloudRows, localIds, options = {}) {
  const {
    missingRatioThreshold = OCR_MISSING_RATIO,
    minMissing = OCR_MIN_MISSING,
    minLocalIds = OCR_MIN_LOCAL_IDS,
  } = options;
  const local = Array.isArray(localIds) ? localIds : [];
  const cloudFolded = new Set(
    (Array.isArray(cloudRows) ? cloudRows : [])
      .filter((row) => row && !row.isSection && row.activityId)
      .map((row) => foldOcrId(row.activityId)),
  );
  const missing = local.filter((id) => !cloudFolded.has(id.folded));
  const localCount = local.length;
  const missingRatio = localCount ? missing.length / localCount : 0;
  let needsRerun = false;
  let reason = "ok";
  if (localCount < minLocalIds) {
    reason = `local engine only read ${localCount} id(s) — not enough signal`;
  } else if (missing.length >= minMissing && missingRatio >= missingRatioThreshold) {
    needsRerun = true;
    reason = `${missing.length}/${localCount} ids (${Math.round(missingRatio * 100)}%) missing from the cloud answer`;
  } else if (missing.length > 0) {
    reason = `${missing.length}/${localCount} ids missing (below the re-read threshold)`;
  }
  return { localCount, cloudCount: cloudFolded.size, missing, missingRatio, needsRerun, reason };
}


// ── Settings (persisted in localStorage) ─────────────────────────────────────

/** @returns {{enabled:boolean, engine:string, url:string, model:string}} */
export function loadLocalOcrSettings() {
  const fallback = { enabled: true, engine: "ppocr", url: LOCAL_OCR_DEFAULT_URL, model: "" };
  try {
    const raw = localStorage.getItem(LOCAL_OCR_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const engine = engineById(parsed?.engine).id;
    return {
      enabled: parsed?.enabled !== false,
      engine,
      url: String(parsed?.url || engineById(engine).defaultUrl).replace(/\/+$/, ""),
      model: String(parsed?.model || ""),
    };
  } catch {
    return fallback;
  }
}

export function saveLocalOcrSettings(patch) {
  const next = { ...loadLocalOcrSettings(), ...(patch || {}) };
  try {
    localStorage.setItem(LOCAL_OCR_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode — the in-memory value is enough */
  }
  return next;
}

// ── Service calls (best-effort: never throw at the caller) ───────────────────

async function postJson(url, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

/** Is the configured engine answering? (Short timeout — an absent service is normal.) */
export async function probeLocalOcr(settingsOrUrl = {}, timeoutMs = 25000) {
  const settings = typeof settingsOrUrl === "string"
    ? { engine: "ppocr", url: settingsOrUrl }
    : { engine: "ppocr", url: LOCAL_OCR_DEFAULT_URL, ...(settingsOrUrl || {}) };
  const engine = engineById(settings.engine);
  const base = String(settings.url || engine.defaultUrl).replace(/\/+$/, "");
  const started = Date.now();
  const failed = (error) => ({
    available: false, engine: engine.id, version: "", models: [], ms: Date.now() - started,
    ready: false, error: String(error?.message || error),
  });
  try {
    if (engine.id === "ollama") {
      const [version, tags] = await Promise.allSettled([
        getJson(`${base}/api/version`, timeoutMs),
        getJson(`${base}/api/tags`, timeoutMs),
      ]);
      if (tags.status === "rejected") return failed(tags.reason);
      const models = (tags.value?.models || []).map((m) => m.name);
      return {
        available: true, engine: engine.id, version: version.status === "fulfilled" ? String(version.value?.version || "") : "",
        models, ms: Date.now() - started, ready: models.length > 0, error: null,
      };
    }
    if (engine.id === "pstocr") {
      const health = await getJson(`${base}/health`, timeoutMs);
      let models = [];
      try {
        const engines = await getJson(`${base}/engines`, 8000);
        models = (engines?.engines || []).map((e) => (typeof e === "string" ? e : e?.id || e?.name)).filter(Boolean);
      } catch { /* optional endpoint */ }
      return {
        available: health?.ok !== false, engine: engine.id, version: String(health?.engine || health?.model || ""),
        models, ms: Date.now() - started, ready: health?.ok !== false, error: health?.error || null,
      };
    }
    const health = await getJson(`${base}/health`, timeoutMs);         // ppocr
    return {
      available: health?.ok !== false, engine: engine.id, version: String(health?.version || ""),
      models: [], ms: Date.now() - started, ready: health?.ready !== false, error: health?.error || null,
    };
  } catch (error) {
    return failed(error);
  }
}

/**
 * Crop the left ID/Activity-Name column of a rendered page.
 *
 * Measured 2026-09-21 on a 2800×1980 dense P6 print (this CPU, PP-OCRv5 mobile):
 *   full page 2800px  → >4 min, ids with typos
 *   full page 1400px  → 88 s,    15/29 ids, typos ("WSD-MC-1790")
 *   left strip 22%    → 35 s,    20/20 ids, no typos
 * The cross-check only needs the ID list, and the strip keeps every ID at full
 * resolution, so this is both faster and more accurate than reading the page.
 */
export async function cropIdColumn(blob, fraction = 0.22) {
  const bitmap = await createImageBitmap(blob);
  const width = Math.max(1, Math.round(bitmap.width * Math.min(Math.max(fraction, 0.08), 0.6)));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, bitmap.height, 0, 0, width, bitmap.height);
  bitmap.close?.();
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
}

/** Blob → bare base64 (no data: prefix), which is what the OCR services expect. */
export async function blobToBase64(blob) {
  if (typeof FileReader === "undefined") {
    // Node (scripts / tests) — FileReader is browser-only.
    const buffer = await blob.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(new Error("could not read the page image"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Read one page with the configured local engine.
 *
 * @param blob     the rendered page (an ID-column strip is cropped from it by default)
 * @param settings `{ engine, url, model }` or just a URL string (PP-OCR shape)
 * @returns {Promise<{lines:string[], text:string, ids:{folded,display}[], ms:number, engine:string}|null>}
 */
export async function readPageLocally(blob, settings = {}, timeoutMs = 240000, options = {}) {
  const { strip = true, stripFraction = 0.22 } = options;
  const config = typeof settings === "string"
    ? { engine: "ppocr", url: settings }
    : { engine: "ppocr", url: LOCAL_OCR_DEFAULT_URL, ...(settings || {}) };
  const engine = engineById(config.engine);
  const base = String(config.url || engine.defaultUrl).replace(/\/+$/, "");
  try {
    const source = strip ? (await cropIdColumn(blob, stripFraction)) || blob : blob;
    const image = await blobToBase64(source);
    let text = "";
    let serviceMs = null;
    if (engine.id === "ollama") {
      if (!config.model) return null;              // needs a model name (e.g. ovisocr2:bf)
      const data = await postJson(`${base}/api/generate`, {
        model: config.model,
        prompt: "Transcribe every line of text on this Gantt programme page exactly as printed, one line per row. Output plain text only, no commentary, no summary.",
        images: [image],
        stream: false,
        options: { temperature: 0 },
      }, timeoutMs);
      text = data?.response || "";
    } else if (engine.id === "pstocr") {
      const data = await postJson(`${base}/ocr/base64`, { data: image, filename: "page.jpg", page: 1 }, timeoutMs);
      text = data?.text || data?.markdown || (Array.isArray(data?.pages) ? data.pages.map((p) => p.text || p.markdown || "").join("\n") : "");
    } else {
      const data = await postJson(`${base}/ocr`, { image }, timeoutMs);
      if (data?.error) return null;
      serviceMs = data?.ms ?? null;
      text = data?.text || (Array.isArray(data?.lines) ? data.lines.join("\n") : "");
    }
    if (!text || !String(text).trim()) return null;
    const lines = String(text).split("\n").map((line) => line.trim()).filter(Boolean);
    return { lines, text: String(text), ids: extractActivityIds(text), ms: serviceMs, engine: engine.id };
  } catch {
    return null;                                  // the cross-check is optional
  }
}

// ── Launcher: start a local engine on demand (batch 25d) ─────────────────────
// A browser cannot start a local process, so the PP-OCR helper service doubles as a
// launcher: switching the engine in the UI asks it to bring the chosen service up,
// then polls until it answers. Only pre-registered commands exist server-side.

export const LOCAL_OCR_LAUNCHER_URL = LOCAL_OCR_DEFAULT_URL;

/** Which local engines can this machine start, and which are already up? */
export async function probeLauncher(url = LOCAL_OCR_LAUNCHER_URL, timeoutMs = 6000) {
  try {
    const data = await getJson(`${String(url).replace(/\/+$/, "")}/launch/services`, timeoutMs);
    return { available: data?.ok !== false, services: Array.isArray(data?.services) ? data.services : [], error: null };
  } catch (error) {
    return { available: false, services: [], error: String(error?.message || error) };
  }
}

export async function startLocalService(id, url = LOCAL_OCR_LAUNCHER_URL) {
  try {
    const data = await postJson(`${String(url).replace(/\/+$/, "")}/launch/start`, { id }, 20000);
    return { started: !!data?.started, alreadyRunning: !!data?.alreadyRunning, pid: data?.pid ?? null, error: null };
  } catch (error) {
    return { started: false, alreadyRunning: false, pid: null, error: String(error?.message || error) };
  }
}

export async function stopLocalService(id, url = LOCAL_OCR_LAUNCHER_URL) {
  try {
    const data = await postJson(`${String(url).replace(/\/+$/, "")}/launch/stop`, { id }, 15000);
    return { stopped: !!data?.stopped, error: null };
  } catch (error) {
    return { stopped: false, error: String(error?.message || error) };
  }
}

/**
 * Make sure the configured engine answers, starting it through the launcher when an
 * engine was just switched to and nothing is listening yet.
 *
 * @returns {{available:boolean, started:boolean, canAutoStart:boolean, hint?:string,
 *            engine:string, version:string, models:string[]}}
 */
export async function ensureEngineRunning(settings, options = {}) {
  const { launcherUrl = LOCAL_OCR_LAUNCHER_URL, onProgress, waitMs = 240000, pollMs = 4000 } = options;
  const first = await probeLocalOcr(settings, 8000);
  if (first.available) return { ...first, started: false, canAutoStart: true };

  const launcher = await probeLauncher(launcherUrl);
  if (!launcher.available) {
    return {
      ...first, started: false, canAutoStart: false,
      hint: "start the PP-OCR helper (C:\\dev\\paddle-ocr\\run-ocr-server.bat) once — after that, engines are started for you",
    };
  }
  const service = launcher.services.find((entry) => entry.id === settings.engine);
  if (!service) {
    return { ...first, started: false, canAutoStart: false, hint: `the launcher does not know an engine named "${settings.engine}"` };
  }
  if (!service.canStart) {
    return { ...first, started: false, canAutoStart: false, hint: `${service.label} cannot be started from here (executable not found)` };
  }

  onProgress && onProgress(`starting ${service.label}…`);
  const launch = await startLocalService(settings.engine, launcherUrl);
  if (!launch.started && !launch.alreadyRunning && launch.error) {
    return { ...first, started: false, canAutoStart: true, hint: launch.error };
  }
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    const probe = await probeLocalOcr(settings, 6000);
    if (probe.available) {
      onProgress && onProgress(`${service.label} is up`);
      return { ...probe, started: true, canAutoStart: true };
    }
    const waited = Math.round((waitMs - (deadline - Date.now())) / 1000);
    onProgress && onProgress(`waiting for ${service.label}… ${waited}s`);
  }
  return {
    ...first, started: false, canAutoStart: true,
    hint: `${service.label} did not answer within ${Math.round(waitMs / 1000)}s (the first start can take a while)`,
  };
}

/** Prompt for the second look: the page image is re-sent together with the local OCR text. */
export function buildRecoveryPrompt({ pageLabel, missingIds, localText, maxChars = 12000 }) {
  const list = (missingIds || []).map((id) => id.display || id.folded).filter(Boolean);
  return [
    "A first pass over this page MISSED rows. Read the page again, carefully, and extract EVERY row — especially the ones with these activity IDs (read from a local OCR pass of the same page):",
    list.length ? list.map((id) => `- ${id}`).join("\n") : "- (none listed — extract every row you can see)",
    "",
    "The text below came from an OCR engine reading the same page. Treat it as a checklist of what is present (it may contain OCR typos), but take dates and fields from the image:",
    String(localText || "").slice(0, maxChars),
    "",
    `Page: ${pageLabel}. Return only rows you can actually see; never invent a row.`,
  ].join("\n");
}

/**
 * Splice recovered rows back where they belong (batch 25: "put them back in place").
 *
 * The base order is preserved. Walking the recovered list in order:
 *   · an ID the page already has becomes an anchor (fills fields the row left empty);
 *   · a new ID is inserted right after the current anchor, so the page reads in its
 *     original order instead of the new rows being dumped at the end.
 *
 * @returns {{rows:Array, enriched:number, added:number, addedIds:string[]}}
 */
export function mergeRecoveredRows(baseRows, recoveredRows) {
  const rows = (Array.isArray(baseRows) ? baseRows : []).map((row) => ({ ...row }));
  const recovered = (Array.isArray(recoveredRows) ? recoveredRows : []).filter((row) => row && !row.isSection);
  if (!recovered.length) return { rows, enriched: 0, added: 0, addedIds: [] };

  const indexOfId = new Map();
  rows.forEach((row, i) => {
    if (row?.activityId) indexOfId.set(foldOcrId(row.activityId), i);
  });

  const FIELDS = ["activity", "start", "end", "baselineStart", "baselineFinish", "remainDur", "float", "pct"];
  let enriched = 0;
  let added = 0;
  const addedIds = [];
  let cursor = -1;                                // index of the last anchor

  recovered.forEach((row) => {
    const folded = row.activityId ? foldOcrId(row.activityId) : "";
    const at = folded ? indexOfId.get(folded) : undefined;
    if (at !== undefined) {
      const target = rows[at];
      let touched = false;
      FIELDS.forEach((field) => {
        const empty = target[field] === undefined || target[field] === null || target[field] === "";
        if (empty && row[field] !== undefined && row[field] !== null && row[field] !== "") {
          target[field] = row[field];
          touched = true;
        }
      });
      if (touched) enriched += 1;
      cursor = Math.max(cursor, at);
      return;
    }
    const insertAt = cursor + 1;
    rows.splice(insertAt, 0, { ...row });
    if (folded) indexOfId.set(folded, insertAt);
    rows.forEach((candidate, i) => {              // keep the map honest after splicing
      if (candidate?.activityId) indexOfId.set(foldOcrId(candidate.activityId), i);
    });
    cursor = insertAt;
    added += 1;
    addedIds.push(row.activityId || row.activity || "(no id)");
  });

  return { rows, enriched, added, addedIds };
}
