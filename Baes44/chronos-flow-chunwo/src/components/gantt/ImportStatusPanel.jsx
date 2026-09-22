/**
 * ImportStatusPanel — 匯入狀態檢視浮動面板
 * 顯示最近一次匯入（XER/PLF）的欄位完整性報告
 */
import { useState } from "react";
import { CheckCircle, AlertCircle, XCircle, X, ChevronDown, ChevronUp } from "lucide-react";
import { levelStatsLabel } from "@/lib/wbsLevel";

// 所有已知欄位定義，key = task 屬性，label = 顯示名稱
const FIELD_DEFS = [
  { key: "activityId",     label: "Activity ID",        critical: true  },
  { key: "activity",       label: "Activity Name",       critical: true  },
  { key: "start",          label: "Start Date",          critical: true  },
  { key: "end",            label: "End Date",            critical: true  },
  { key: "remainDur",      label: "Remaining Duration",  critical: false },
  { key: "float",          label: "Total Float",         critical: false },
  { key: "pct",            label: "% Complete",          critical: false },
  { key: "lateStart",      label: "Late Start",          critical: false },
  { key: "lateEnd",        label: "Late Finish",         critical: false },
];

/**
 * Analyse imported tasks and return a field-level report.
 * @param {Array} tasks - raw imported task array (non-section only)
 * @param {string} fileType - "XER" | "PLF" | "Excel" | etc.
 */
export function buildImportReport(tasks, fileType = "File") {
  const nonSectionTasks = tasks.filter(t => !t.isSection);
  const total = nonSectionTasks.length;
  if (total === 0) return null;

  const fields = FIELD_DEFS.map(def => {
    const filled = nonSectionTasks.filter(t => {
      const v = t[def.key];
      return v !== undefined && v !== null && v !== "" && v !== 0 || (def.key === "pct" && v === 0);
    }).length;
    return {
      ...def,
      filled,
      total,
      pct: Math.round((filled / total) * 100),
    };
  });

  return { fileType, total, fields, timestamp: new Date() };
}

export default function ImportStatusPanel({ report, onClose }) {
  const [expanded, setExpanded] = useState(true);

  if (!report) return null;

  const { fileType, total, fields, timestamp, matchedCount, wbsLevels, coverage } = report;
  const criticalOk = fields.filter(f => f.critical && f.filled < f.total);
  const allGood = criticalOk.length === 0;
  const isBaselineMode = matchedCount !== undefined;

  return (
    <div
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 9999,
        width: 340, background: "#fff", borderRadius: 10,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        border: "1px solid #cecece",
        overflow: "hidden",
        animation: "fadeIn 0.2s ease-out",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: isBaselineMode ? (matchedCount > 0 ? "#f7f7f7" : "#fff2ea") : (allGood ? "#f7f7f7" : "#fff2ea"),
          borderBottom: "1px solid #cecece",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setExpanded(v => !v)}
      >
        {isBaselineMode
          ? (matchedCount > 0
              ? <CheckCircle size={16} style={{ color: "#005a53", flexShrink: 0 }} />
              : <AlertCircle size={16} style={{ color: "#b15315", flexShrink: 0 }} />)
          : (allGood
              ? <CheckCircle size={16} style={{ color: "#005a53", flexShrink: 0 }} />
              : <AlertCircle size={16} style={{ color: "#b15315", flexShrink: 0 }} />)
        }
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#003531" }}>
            {isBaselineMode ? `Baseline Mapping — ${fileType}` : `Import Report — ${fileType}`}
          </div>
          <div style={{ fontSize: 11, color: "#6c757d", marginTop: 1 }}>
            {isBaselineMode
              ? `${matchedCount} of ${total} activities matched`
              : `${total} activities · ${timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {expanded ? <ChevronDown size={14} color="#6c757d" /> : <ChevronUp size={14} color="#6c757d" />}
          <button
            onClick={e => { e.stopPropagation(); onClose(); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, lineHeight: 1, color: "#6c757d" }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: "10px 12px", maxHeight: 360, overflowY: "auto" }}>
          {/* Critical fields */}
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6c757d", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Required Fields
          </div>
          {fields.filter(f => f.critical).map(f => (
            <FieldRow key={f.key} f={f} />
          ))}

          {/* Optional fields */}
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6c757d", marginTop: 10, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Optional Fields
          </div>
          {fields.filter(f => !f.critical).map(f => (
            <FieldRow key={f.key} f={f} />
          ))}

          {/* Batch 12/24: was the full programme embedded in this file? */}
          {coverage && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6c757d", marginTop: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Source Coverage
              </div>
              <div style={{ fontSize: 11, color: "#333333", lineHeight: 1.5 }}>
                {coverage.kind === "embedded" && (
                  <>
                    🔖 <span style={{ fontWeight: 700, color: "#005a53" }}>Instant restore</span> — this PDF carried the
                    full programme ({coverage.rows} rows, every field). No AI reading was needed.
                  </>
                )}
                {coverage.kind === "pdf-text" && (
                  <>
                    No embedded data in this file — read as PDF text. All{" "}
                    <span style={{ fontWeight: 700 }}>{coverage.pages}</span> page(s) sent in{" "}
                    <span style={{ fontWeight: 700 }}>{coverage.batches}</span> batch(es) ·{" "}
                    {coverage.chars.toLocaleString()} characters · {coverage.rows} rows read
                  </>
                )}
                {coverage.kind === "vision" && (
                  <>
                    No embedded data in this file — read as scanned page(s). All{" "}
                    <span style={{ fontWeight: 700 }}>{coverage.pages}</span> page(s) sent, one AI call each ·{" "}
                    {coverage.rows} rows read
                  </>
                )}
                {coverage.kind === "vision-image" && <>No embedded data — single image read by AI · {coverage.rows} rows</>}
                {coverage.kind === "excel-batches" && (
                  <>
                    All <span style={{ fontWeight: 700 }}>{coverage.pages}</span> sheet(s) sent in{" "}
                    <span style={{ fontWeight: 700 }}>{coverage.batches}</span> batch(es) · {coverage.rows} rows read
                  </>
                )}
              </div>
              {coverage.crossCheck && (
                <div style={{ fontSize: 11, color: "#333333", marginTop: 4, lineHeight: 1.5 }}>
                  Local OCR cross-check ({coverage.crossCheck.engine}):{" "}
                  {coverage.crossCheck.unavailable && coverage.crossCheck.pagesVerified === 0 ? (
                    <>service not reachable — pages were not verified</>
                  ) : (
                    <>
                      {coverage.crossCheck.pagesVerified} page(s) verified against a local OCR pass
                      {coverage.crossCheck.pagesRerun > 0
                        ? ` · ${coverage.crossCheck.pagesRerun} page(s) re-read → +${coverage.crossCheck.rowsRecovered} row(s) recovered, ${coverage.crossCheck.rowsCompleted} row(s) completed`
                        : " · no page needed a re-read"}
                    </>
                  )}
                </div>
              )}
              {coverage.kind !== "embedded" && (
                <div style={{ fontSize: 10, color: "#6c757d", marginTop: 3 }}>
                  Tip: a PDF exported by this app re-imports instantly and losslessly. Re-saving or printing this file
                  with another tool strips that marker.
                </div>
              )}
            </>
          )}

          {/* Batch 23C: WBS levels derived from the section numbering */}
          {wbsLevels && wbsLevels.sections > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6c757d", marginTop: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                WBS Levels
              </div>
              <div style={{ fontSize: 11, color: "#333333", lineHeight: 1.5 }}>
                {wbsLevels.inferred > 0 ? (
                  <>
                    <span style={{ fontWeight: 700, color: "#005a53" }}>{wbsLevels.inferred}</span>
                    {" of "}
                    {wbsLevels.sections}
                    {" section titles got a level — "}
                    {wbsLevels.fromTitle > 0 && <>{wbsLevels.fromTitle} from the title numbering</>}
                    {wbsLevels.fromTitle > 0 && wbsLevels.fromAi > 0 && " and "}
                    {wbsLevels.fromAi > 0 && <>{wbsLevels.fromAi} from the WBS bands on the chart</>}
                    {" — "}
                    <span style={{ fontWeight: 700 }}>{levelStatsLabel(wbsLevels)}</span>
                  </>
                ) : (
                  <>No WBS numbering found in the section titles — all sections stay at Level 1.</>
                )}
                {wbsLevels.kept > 0 && <> {wbsLevels.kept} existing level(s) kept (XER hierarchy).</>}
                {wbsLevels.unresolved > 0 && <> {wbsLevels.unresolved} without a recognisable code.</>}
              </div>
              <div style={{ fontSize: 10, color: "#6c757d", marginTop: 3 }}>
                Right-click any programme row → WBS Level to adjust it by hand.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FieldRow({ f }) {
  const isComplete = f.filled === f.total;
  const isEmpty = f.filled === 0;
  const color = isComplete ? "#005a53" : isEmpty ? "#dc3545" : "#b15315";
  const Icon = isComplete ? CheckCircle : isEmpty ? XCircle : AlertCircle;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid #f7f7f7" }}>
      <Icon size={13} style={{ color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 12, color: "#003531" }}>{f.label}</span>
      <span style={{ fontSize: 11, color, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        {isComplete ? "✓ All" : `${f.filled}/${f.total}`}
      </span>
      {/* Mini bar */}
      <div style={{ width: 40, height: 4, background: "#cecece", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${f.pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}