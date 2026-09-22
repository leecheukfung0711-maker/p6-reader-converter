# CJK font for the printed PDF

`NotoSansHK-VF.ttf` — **Noto Sans HK** (built from Adobe’s Source Han Sans), variable
TrueType font, ~11 MB. It is loaded **lazily** by `src/lib/cjkFont.js` and only when the
programme being printed contains text outside Latin-1, so Latin-only exports never fetch it.

## License

SIL Open Font License 1.1 — full text in `OFL.txt` (copied from
<https://github.com/google/fonts/blob/main/ofl/notosanshk/OFL.txt>).
The font’s own `name` table carries the same notice:

```
Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'
```

OFL allows embedding and redistribution, so the file can ship with this repository and be
embedded (subsetted) into the exported PDFs. Keep `OFL.txt` next to the font when moving it.

## How it is used

* `src/lib/cjkFont.js` fetches `/fonts/NotoSansHK-VF.ttf`, converts it to base64 (chunked)
  and caches it in memory for the session (repeat visits come from the HTTP cache).
* `src/lib/exportGanttPDF.js` registers it via `addFileToVFS` / `addFont` and routes every
  core-font request (`helvetica`, `courier`, `times`) to it, then lets `sanitizePDFText()`
  keep the real Unicode characters.
* **jsPDF subsets the embedded font**, so the PDF only grows by the glyphs actually used —
  measured 288 KB for a Chinese page vs 11 KB without any CJK text.

## Swapping the font

Any TrueType (`.ttf`) font with `glyf` outlines works — CFF/OTF and `.ttc` collections do
not. Replace the file and update `CJK_FONT_URL` / `CJK_FONT_LABEL` in `src/lib/cjkFont.js`
(plus this note and `OFL.txt`). A Hong Kong / Traditional Chinese font is the best fit for
these programmes; Noto Sans HK, Noto Sans TC and Noto Sans SC all cover the same ideographs
with different regional glyph variants.
