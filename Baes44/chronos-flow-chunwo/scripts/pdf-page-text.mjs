/**
 * Dump PDF page text EXACTLY the way the app builds it (batch 24):
 * pdfjs-dist getTextContent() → group items by rounded Y → sort by X within a row
 * → one line per row. Use it to reproduce what the text import actually sends.
 *
 *   node scripts/pdf-page-text.mjs <file.pdf> <firstPage> <lastPage> [outFile]
 */
import { writeFileSync } from "node:fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";

const [file, firstArg, lastArg, outArg] = process.argv.slice(2);
if (!file) { console.error("usage: node scripts/pdf-page-text.mjs <file.pdf> <firstPage> <lastPage> [outFile]"); process.exit(2); }
const first = Number(firstArg) || 1;
const last = Number(lastArg) || first;

const doc = await pdfjsLib.getDocument({ data: new Uint8Array(readFileSync(file)) }).promise;
const parts = [];
for (let pageNum = first; pageNum <= Math.min(last, doc.numPages); pageNum += 1) {
  const page = await doc.getPage(pageNum);
  const content = await page.getTextContent();
  const byY = {};
  for (const item of content.items) {
    if (!item.str.trim()) continue;
    const y = Math.round(item.transform[5]);
    (byY[y] = byY[y] || []).push({ x: item.transform[4], str: item.str });
  }
  const text = Object.keys(byY).sort((a, b) => b - a)
    .map((y) => byY[y].sort((a, b) => a.x - b.x).map((i) => i.str).join("  "))
    .join("\n");
  parts.push(text);
}
const joined = parts.join("\n");
if (outArg) { writeFileSync(outArg, joined, "utf8"); console.log(`wrote ${outArg} (${joined.length} chars, pages ${first}-${Math.min(last, doc.numPages)})`); }
else console.log(joined);
console.log(`lines: ${joined.split("\n").length}, activity-id-like tokens: ${(joined.match(/[A-Za-z]{2,6}-[A-Za-z0-9]{1,8}-\d{1,5}/g) || []).length}`);
