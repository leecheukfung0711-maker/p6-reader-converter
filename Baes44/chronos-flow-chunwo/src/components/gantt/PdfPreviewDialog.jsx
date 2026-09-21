import { useEffect } from "react";
import { X, FileDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Print preview shown before the Gantt PDF is exported.
 *
 * The PDF bytes produced by `buildGanttPDF` are embedded in an iframe, so what
 * the user sees is **exactly** the file that will be downloaded (no second
 * layout engine that could drift), and the browser's own PDF viewer supplies
 * zoom / page scrolling / print.
 *
 * Toolbar: page count · open in new tab · download · close (Esc also closes).
 */
export default function PdfPreviewDialog({
  pdfUrl,
  filename = "Gantt.pdf",
  title = "Print Preview",
  pageCount = null,
  onDownload,
  onClose,
}) {
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!pdfUrl) return null;

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
          </span>

          <div className="hidden sm:block h-6 border-l border-text-muted mx-1" />

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

      {/* The real PDF (browser viewer) — the loading hint sits behind it */}
      <div className="relative w-full flex-grow min-h-0 rounded-b-lg shadow-2xl bg-surface-muted">
        <div className="absolute inset-0 flex items-center justify-center text-sm text-text-muted pointer-events-none">
          Loading PDF preview…
        </div>
        <iframe
          src={pdfUrl}
          title={filename}
          className="absolute inset-0 w-full h-full border-0 bg-surface rounded-b-lg"
        />
      </div>
    </div>
  );
}
