/**
 * Batch 45 — CJK font for the printed PDF.
 *
 * jsPDF's built-in fonts cover Latin-1 only, so `sanitizePDFText()` used to replace every
 * Chinese character with "?". This module loads the CJK-capable TrueType font shipped in
 * `public/fonts/NotoSansHK-VF.ttf` (Noto Sans HK / Source Han Sans, **SIL OFL 1.1** — see
 * `public/fonts/OFL.txt`) and hands it to the PDF builder as base64.
 *
 * jsPDF **subsets** embedded fonts, so the printed file stays small: measured 275 KB for a
 * page of Chinese with the full 11 MB font. The font is fetched lazily — only when a
 * programme actually contains non-Latin text — and cached in memory for the session
 * (repeat visits come from the browser's HTTP cache).
 */
export const CJK_FONT_URL = "/fonts/NotoSansHK-VF.ttf";
export const CJK_FONT_NAME = "NotoSansHK";

let cachedBase64 = null;
let pending = null;
let lastError = null;

/** True when the value has anything outside Latin-1, i.e. needs a real Unicode font. */
export function hasNonLatinText(value) {
  return /[^\u0000-\u00ff]/.test(String(value ?? ""));
}

/**
 * True when the printed text of this programme needs a CJK font: any activity / item /
 * label text plus whatever the caller passes (project title, company, footers …).
 */
export function programmeNeedsCjk(tasks, extraTexts = []) {
  if (extraTexts.some(hasNonLatinText)) return true;
  return (tasks || []).some((t) => t && (
    hasNonLatinText(t.activity) || hasNonLatinText(t.activityId) ||
    hasNonLatinText(t.item) || hasNonLatinText(t.customItem)
  ));
}

/** The base64 font once loaded, otherwise null (the PDF builder stays synchronous). */
export function cjkFontBase64() {
  return cachedBase64;
}


/**
 * Fetch the font and cache it as base64. Chunked conversion: `String.fromCharCode(...)`
 * on an 11 MB buffer would exceed the argument limit.
 */
export async function loadCjkFont() {
  if (cachedBase64) return cachedBase64;
  if (pending) return pending;
  pending = (async () => {
    const res = await fetch(CJK_FONT_URL);
    if (!res.ok) throw new Error(`CJK font request failed (${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    cachedBase64 = btoa(binary);
    lastError = null;
    return cachedBase64;
  })();
  try {
    return await pending;
  } catch (err) {
    lastError = err?.message || String(err);
    throw err;
  } finally {
    pending = null;
  }
}
