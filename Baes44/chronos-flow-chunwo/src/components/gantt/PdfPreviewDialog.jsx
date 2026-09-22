import { useEffect, useState } from "react";
import { X, FileDown, ExternalLink, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * What else can be put on the paper (batch 26). Each entry must exist as a
 * `buildGanttPDF` option — the panel is the only place these are chosen.
 */
const PRINT_CONTENT = [
  { key: "embedCjkFont", label: "Chinese / CJK text", hint: "Embed Noto Sans HK (SIL OFL 1.1) so Chinese prints as real text instead of ???? — only fetched when the programme has non-Latin text" },
  { key: "showHolidays", label: "Holiday markers", hint: "Shade Hong Kong public holidays in the timeline" },
  { key: "showToday", label: "Today line", hint: "Red vertical line at today's date" },
  { key: "showStaircase", label: "Staircase line", hint: "Steps across each programme's bar finishes" },
  { key: "showRelationshipLines", label: "Relationship lines", hint: "Predecessor → successor arrows (drawn within a page)" },
  { key: "showRecalcDate", label: "Last Recalc Date line", hint: "Dashed orange data-date line (set it by right-clicking a date column)" },
  { key: "showComparisonBars", label: "Comparison bars", hint: "Baseline / late comparison bars (brown, same as the chart) — off by default in the printout" },
  { key: "showComparisonArrows", label: "Comparison arrows", hint: "Finish-date difference between adjacent programmes (brown, Wd/Cal label) — same rule as Display ▸ Comparison Arrows" },
];

/**
 * What is written ON the bars (batch 31). These are the very same switches as
 * Gantt Bars ▸ Bar Info ▸ Bar Info, kept here as well so the printout can be
 * finished without leaving the preview — ticking one changes the chart too
 * (one setting, screen and paper can never drift apart).
 */
const BAR_TEXT_OPTIONS = [
  { key: "showName",   label: "Names on bars",        hint: "Activity name on every bar" },
  { key: "showStart",  label: "Start dates on bars",  hint: "Start date on every bar" },
  { key: "showFinish", label: "Finish dates on bars", hint: "Finish date on every bar" },
];

/**
 * Print preview shown before the Gantt PDF is exported.
 *
 * The PDF bytes produced by `buildGanttPDF` are embedded in an iframe, so what
 * the user sees is **exactly** the file that will be downloaded (no second
 * layout engine that could drift), and the browser's own PDF viewer supplies
 * zoom / page scrolling / print.
 *
 * Toolbar: page count · open in new tab · download · close (Esc also closes).
 * Batch 26 adds the "Print content" panel: ticking an option rebuilds the PDF and
 * the preview refreshes, so the download always matches what is on screen.
 */
export default function PdfPreviewDialog({
  pdfUrl,
  filename = "Gantt.pdf",
  title = "Print Preview",
  pageCount = null,
  builtAt = null,
  sizeBytes = null,
  printOptions = null,
  onPrintOptionChange,
  barInfo = null,
  onBarInfoChange,
  onComparisonChange,
  onComparisonArrowsChange,
  onCjkFontChange,
  cjkStatus = null,
  onDownload,
  onClose,
}) {
  const [showPanel, setShowPanel] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!pdfUrl) return null;

  const toggle = (key, value) => {
    if (!onPrintOptionChange) return;
    setRebuilding(true);
    // Rebuilding a large PDF is synchronous; yield once so the spinner paints.
    setTimeout(() => {
      try { onPrintOptionChange({ [key]: value }); } finally { setRebuilding(false); }
    }, 0);
  };
  // Bar text is a shared setting (chart + print): same idea, different handler.
  const toggleBarText = (key, value) => {
    if (!onBarInfoChange) return;
    setRebuilding(true);
    setTimeout(() => {
      try { onBarInfoChange({ [key]: value }); } finally { setRebuilding(false); }
    }, 0);
  };
  const canChoose = !!printOptions && !!onPrintOptionChange;
  const canChooseBarText = !!onBarInfoChange;

  /**
   * Checkbox state for a "Print content" row.
   * Batch 33 — the old expression treated an explicit `false` as "not set" and fell
   * back to the default, so unticking "Comparison bars" left the box ticked.
   * Batch 34 — every print option defaults to OFF (comparison bars used to default to
   * on), so only `true` renders a tick; `undefined` means "never chosen" → unticked.
   */
  const isChecked = (option) => {
    const value = printOptions ? printOptions[option.key] : undefined;
    return value === undefined ? false : !!value;
  };
  /**
   * Comparison bars: the tick is the print switch; the same value also flips the Display
   * panel's "Comparison Arrows" flag so the chart's comparison arrows match the printout.
   */
  const onComparisonToggle = (value) => {
    if (onComparisonChange) onComparisonChange(value);
    else toggle("showComparisonBars", value);
  };
  /**
   * Batch 39 — the comparison arrows are offered here too: the tick is a print option and
   * it also opens the programmes' Compare flag, so a tick always draws them on paper.
   */
  const onComparisonArrowsToggle = (value) => {
    if (onComparisonArrowsChange) onComparisonArrowsChange(value);
    else toggle("showComparisonArrows", value);
  };
  /**
   * Batch 45 — "Chinese / CJK text": loads the font before rebuilding, so the preview that
   * appears right after the tick already shows real Chinese.
   */
  const onCjkFontToggle = (value) => {
    if (onCjkFontChange) onCjkFontChange(value);
    else toggle("embedCjkFont", value);
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 flex flex-col items-center justify-start pt-8 pb-8 px-4 md:px-8"
      role="dialog"
      aria-modal="true"
      aria-label="PDF preview"
    >
      {/* Toolbar */}
      <div className="bg-primary-dark text-surface w-full rounded-t-lg shadow-2xl flex flex-wrap items-center justify-between gap-y-2 gap-x-2 p-2 md:p-3">
        <div className="flex items-center min-w-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 mr-2 shrink-0">
            <rect x="4.5" y="3" width="15" height="18" rx="1.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 8.25h7.5M8.25 12h7.5M8.25 15.75h4.5" />
          </svg>
          <h2 className="text-base md:text-lg font-semibold truncate">{title}</h2>
        </div>

        <div className="flex items-center gap-1 md:gap-2 ml-auto">
          <span className="hidden sm:inline text-xs text-text-muted max-w-[45vw] truncate" title={filename}>
            {filename}
            {pageCount ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}` : ""}
            {builtAt ? ` · built ${new Date(builtAt).toLocaleTimeString("en-GB", { hour12: false })}` : ""}
            {sizeBytes ? ` · ${Math.round(sizeBytes / 1024)} KB` : ""}
          </span>

          <div className="hidden sm:block h-6 border-l border-text-muted mx-1" />

          {canChoose && (
            <button
              type="button"
              onClick={() => setShowPanel((v) => !v)}
              title={showPanel ? "Hide print content options" : "Show print content options"}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-sm ${showPanel ? "bg-primary" : "hover:bg-primary-dark"}`}
            >
              <SlidersHorizontal size={16} />
              <span className="hidden md:inline">Print content</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.open(pdfUrl, "_blank", "noopener,noreferrer")}
            title="Open in new tab"
            className="p-2 hover:bg-primary-dark rounded-md"
          >
            <ExternalLink size={18} />
          </button>

          <Button
            size="sm"
            onClick={onDownload}
            title="Download PDF"
            className="bg-primary hover:bg-primary-active text-surface text-sm"
          >
            <FileDown size={14} className="mr-1" />
            <span className="hidden sm:inline">Download PDF</span>
          </Button>

          <button
            type="button"
            onClick={onClose}
            title="Close preview"
            className="p-2 hover:bg-primary-dark rounded-md"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* The real PDF (browser viewer) + the "Print content" panel beside it */}
      <div className="w-full flex-grow min-h-0 flex gap-3">
        {canChoose && showPanel && (
          <aside
            className="w-[248px] shrink-0 overflow-y-auto rounded-lg bg-surface shadow-2xl p-3 text-xs"
            aria-label="Print content options"
          >
            <div className="text-sm font-semibold text-text mb-1">Print content</div>
            <p className="text-text-muted mb-2 leading-snug">
              Choose what is added to the printed file. Ticking a box rebuilds the preview —
              what you see is what gets downloaded.
            </p>
            {PRINT_CONTENT.map((option) => {
              // Comparison bars / arrows go through their own handlers (batch 34/39): the
              // tick is the *print* switch, and flipping it also keeps the Display panel's
              // "Comparison Arrows" flag in step.
              const shared = option.key === "showComparisonBars";
              const sharedArrows = option.key === "showComparisonArrows";
              const sharedCjk = option.key === "embedCjkFont";
              return (
                <label key={option.key} className="flex items-start gap-2 py-1 cursor-pointer" title={option.hint}>
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={isChecked(option)}
                    onChange={(e) => (shared
                      ? onComparisonToggle(e.target.checked)
                      : sharedArrows
                        ? onComparisonArrowsToggle(e.target.checked)
                        : sharedCjk
                          ? onCjkFontToggle(e.target.checked)
                          : toggle(option.key, e.target.checked))}
                  />
                  <span>
                    <span className="text-text font-medium">{option.label}</span>
                    <span className="block text-text-muted leading-snug">{option.hint}</span>
                  </span>
                </label>
              );
            })}
            <p className="text-text-muted mt-2 leading-snug">
              Relationship arrows are drawn inside one page; links that cross a page break are
              skipped because pages print separately.
            </p>

            {/* ── CJK font status (batch 45) ── */}
            {cjkStatus && cjkStatus !== "idle" && (
              <p className="text-text-muted mt-2 leading-snug">
                {cjkStatus === "ready"
                  ? "CJK font ready — Chinese prints as real, selectable text."
                  : cjkStatus === "loading"
                    ? "Loading the CJK font (11 MB, cached after the first time)…"
                    : "CJK font could not be loaded — non-Latin text prints as ?."}
              </p>
            )}

            {/* ── Bar text (batch 31) — the same switches as Gantt Bars ▸ Bar Info ── */}
            {canChooseBarText && (
              <div className="mt-3 border-t border-border pt-2">
                <div className="text-sm font-semibold text-text mb-1">Bar text</div>
                <p className="text-text-muted mb-2 leading-snug">
                  Written on the bars. This is the same setting as Gantt Bars ▸ Bar Info, so the
                  chart updates with it too.
                </p>
                {BAR_TEXT_OPTIONS.map((option) => (
                  <label key={option.key} className="flex items-start gap-2 py-1 cursor-pointer" title={option.hint}>
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={!!(barInfo && barInfo[option.key])}
                      onChange={(e) => toggleBarText(option.key, e.target.checked)}
                    />
                    <span>
                      <span className="text-text font-medium">{option.label}</span>
                      <span className="block text-text-muted leading-snug">{option.hint}</span>
                    </span>
                  </label>
                ))}
                <p className="text-text-muted mt-1 leading-snug">
                  Font, size, colour and position (inside / before / after the bar): Gantt Bars ▸
                  Bar Info ▸ Text style.
                </p>
              </div>
            )}
            {rebuilding && <p className="text-primary font-medium mt-2">Rebuilding preview…</p>}
          </aside>
        )}

        <div className="relative flex-grow min-h-0 rounded-lg shadow-2xl bg-surface-muted">
          <div className="absolute inset-0 flex items-center justify-center text-sm text-text-muted pointer-events-none">
            {rebuilding ? "Rebuilding preview…" : "Loading PDF preview…"}
          </div>
          <iframe
            src={pdfUrl}
            title={filename}
            className="absolute inset-0 w-full h-full border-0 bg-surface rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}
