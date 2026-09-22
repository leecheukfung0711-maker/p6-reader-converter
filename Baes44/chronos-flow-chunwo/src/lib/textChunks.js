/**
 * Page-aligned text batching (batch 24).
 *
 * Why: a 27-page P6 print holds ~99 000 characters and ~610 activities, but the
 * import used to send `nativeText.substring(0, 24000)` in one call — measured at
 * 213 of 614 activity IDs, i.e. **65 % of the document could never be imported**,
 * and which of the visible rows survived changed between runs (same file, two
 * imports, different rows missing).
 *
 * These helpers keep the page boundaries intact so the work can be spread over
 * several model calls and merged back in document order.
 */

/** Split per-page text into page-aligned batches that fit one model call. */
export const TEXT_CHUNK_MAX_CHARS = 12000;
export const TEXT_CHUNK_MAX_PAGES = 3;
// Measured 2026-09-21 on a 27-page P3 print: one 3-page batch (10.6k chars, 37-field
// text schema, ~120 rows out) took ~4 minutes, i.e. the run is output-token bound —
// wall-clock scales with total rows / concurrency. 5 keeps a 10-batch document to
// ~2 rounds (~8-16 min) instead of 4.
export const TEXT_CHUNK_CONCURRENCY = 5;

export function planTextChunks(pageTexts, maxChars = TEXT_CHUNK_MAX_CHARS, maxPages = TEXT_CHUNK_MAX_PAGES) {
  const chunks = [];
  let current = { pages: [], text: "" };
  for (const entry of pageTexts || []) {
    const page = Number(entry?.page) || current.pages.length + 1;
    const text = String(entry?.text || "");
    const wouldOverflow = current.pages.length > 0
      && (current.text.length + text.length > maxChars || current.pages.length >= maxPages);
    if (wouldOverflow) {
      chunks.push(current);
      current = { pages: [], text: "" };
    }
    current.pages.push(page);
    current.text += (current.text ? "\n" : "") + text;
  }
  if (current.pages.length) chunks.push(current);
  return chunks;
}

/** Split an over-long text block on line boundaries so no batch exceeds maxChars. */
export function splitLongText(text, maxChars = TEXT_CHUNK_MAX_CHARS) {
  const lines = String(text || "").split("\n");
  const parts = [];
  let current = "";
  for (const line of lines) {
    if (current && current.length + line.length + 1 > maxChars) { parts.push(current); current = ""; }
    if (line.length > maxChars) {                       // one monster line: hard cut
      for (let i = 0; i < line.length; i += maxChars) parts.push(line.slice(i, i + maxChars));
      continue;
    }
    current += (current ? "\n" : "") + line;
  }
  if (current) parts.push(current);
  return parts.length ? parts : [""];
}

/** Run `fn` over the items with a small worker pool, keeping the input order. */
export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  }));
  return results;
}

/** Concatenate per-chunk task lists in document order, dropping exact repeats. */
export function mergeChunkTasks(taskArrays) {
  const merged = [];
  const seen = new Set();
  for (const list of taskArrays || []) {
    for (const task of list || []) {
      const key = [
        String(task.activityId || "").trim().toLowerCase(),
        String(task.activity || "").trim().toLowerCase(),
        String(task.start || ""),
        String(task.end || ""),
      ].join("|");
      if (key !== "|||" && seen.has(key)) continue;
      if (key !== "|||") seen.add(key);
      merged.push(task);
    }
  }
  return merged;
}

/**
 * Does this text look like a schedule page that should yield rows? Used to decide
 * whether an empty answer is worth one retry (a cover page legitimately has none).
 */
export function looksLikeProgrammeText(text) {
  const value = String(text || "");
  const hasDate = /\d{1,2}[-\s/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s/]?\d{2,4}|\d{4}-\d{2}-\d{2}/i.test(value);
  const hasId = /[A-Za-z]{2,6}-[A-Za-z0-9]{1,8}-\d{1,5}/.test(value);
  return hasDate || hasId;
}
