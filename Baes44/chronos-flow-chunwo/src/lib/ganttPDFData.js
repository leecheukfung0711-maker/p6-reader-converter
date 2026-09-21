/**
 * Embed the FULL Gantt task array inside an exported PDF's metadata, and read it back
 * when the same PDF is uploaded again.
 *
 * Wire format (all on the PDF Info dictionary, so any PDF reader keeps it):
 *   Subject  : "GANTT_DATA_V3:" + <base64 chunk 0>          (V3 = gzip-compressed JSON)
 *              "GANTT_DATA_V2:" + <base64 chunk 0>          (V2 = legacy, uncompressed)
 *   Author   : "chunks:<n>"
 *   Keywords : "GANTT_OVERFLOW:" + <chunk1>|<chunk2>|…
 *
 * Gzip (CompressionStream, available in current browsers + Node 18+) keeps a typical
 * programme at a few tens of KB, which PDF metadata handles comfortably.
 * Both V3 and the legacy V2 payloads are decoded, so already-exported files still work.
 */
const MARK_GZ = "GANTT_DATA_V3:";
const MARK_PLAIN = "GANTT_DATA_V2:";
const OVERFLOW = "GANTT_OVERFLOW:";
const CHUNK_SIZE = 4000;   // characters per metadata field chunk

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : B64[b2 & 63];
  }
  return out;
}

function base64ToBytes(b64) {
  const clean = String(b64).replace(/[^A-Za-z0-9+/=]/g, "");
  const len = clean.length;
  const out = new Uint8Array(Math.floor((len * 3) / 4));
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const n0 = B64.indexOf(clean[i]), n1 = B64.indexOf(clean[i + 1]);
    const n2 = clean[i + 2] === "=" ? -1 : B64.indexOf(clean[i + 2]);
    const n3 = clean[i + 3] === "=" ? -1 : B64.indexOf(clean[i + 3]);
    out[p++] = (n0 << 2) | (n1 >> 4);
    if (n2 >= 0) out[p++] = ((n1 & 15) << 4) | (n2 >> 2);
    if (n3 >= 0) out[p++] = ((n2 & 3) << 6) | n3;
  }
  return out.subarray(0, p);
}

async function gzipToBase64(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  return bytesToBase64(new Uint8Array(buf));
}

async function gunzipFromBase64(b64) {
  const stream = new Blob([base64ToBytes(b64)]).stream().pipeThrough(new DecompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(buf);
}

/**
 * Serialise the whole task array for embedding in a PDF.
 * @returns {Promise<{subject:string, author:string, keywords:string, count:number, bytes:number}|null>}
 */
export async function encodeTasksForPDF(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  if (!list.length) return null;
  const json = JSON.stringify(list);
  let encoded, mark;
  try {
    encoded = await gzipToBase64(json);
    mark = MARK_GZ;
  } catch {
    // Fall back to the legacy uncompressed payload (still read by both decoders)
    encoded = bytesToBase64(new TextEncoder().encode(json));
    mark = MARK_PLAIN;
  }
  const chunks = [];
  for (let i = 0; i < encoded.length; i += CHUNK_SIZE) chunks.push(encoded.slice(i, i + CHUNK_SIZE));
  return {
    subject: mark + chunks[0],
    author: `chunks:${chunks.length}`,
    keywords: chunks.length > 1 ? OVERFLOW + chunks.slice(1).join("|") : "",
    count: list.length,
    bytes: json.length,
  };
}

/** Read an embedded task array back out of a PDF's Info dictionary (null when absent). */
export async function decodeTasksFromPDFInfo(info) {
  const subject = String(info?.Subject ?? info?.subject ?? "");
  const isGz = subject.startsWith(MARK_GZ);
  const isPlain = subject.startsWith(MARK_PLAIN);
  if (!isGz && !isPlain) return null;
  const keywords = String(info?.Keywords ?? info?.keywords ?? "");
  let payload = subject.slice((isGz ? MARK_GZ : MARK_PLAIN).length);
  if (keywords.startsWith(OVERFLOW)) payload += keywords.slice(OVERFLOW.length).split("|").join("");
  try {
    const json = isGz
      ? await gunzipFromBase64(payload)
      : decodeURIComponent(escape(atob(payload)));          // legacy V2 payload
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

/** Does this Info dictionary carry embedded Gantt data? */
export function hasEmbeddedGanttData(info) {
  const subject = String(info?.Subject ?? info?.subject ?? "");
  return subject.startsWith(MARK_GZ) || subject.startsWith(MARK_PLAIN);
}

export { MARK_GZ, MARK_PLAIN, OVERFLOW };
