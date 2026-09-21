/**
 * WbsSettingsPanel — "WBS Settings" drawer, modelled on the XER Viewer panel:
 *   · WBS Row Color Scheme (15 schemes, 3-swatch preview, level 1 / 4 / 7)
 *   · Hide Empty WBS Rows
 *   · Show Group Headers on Gantt
 *   · Custom WBS Level Styles (7 levels: BG · Text · Font · Size · Weight · Reset)
 *
 * All values live in `displaySettings.wbs` (owned & persisted by GanttPage) so the
 * activity table, the Gantt chart labels and the PDF export stay in sync.
 */
import { useState } from "react";
import { X, RotateCcw, Eye, EyeOff, ChevronUp, ChevronDown } from "lucide-react";
import {
  WBS_COLOR_SCHEMES, WBS_FONT_FAMILIES, WBS_FONT_WEIGHTS,
  WBS_LEVEL_COUNT, levelStylesFromScheme, wbsTextColorFor,
  cloneGrouping, wbsLevelOptions, wbsLevelCounts, wbsVisibleGroupCount,
} from "@/lib/displaySettings";

function Switch({ id, label, checked, onChange, title }) {
  return (
    <div className="flex items-center justify-between">
      <label htmlFor={id} className="text-[12px] font-medium text-text">{label}</label>
      <button id={id} role="switch" aria-checked={!!checked} title={title || label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex items-center h-4 rounded-full w-7 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-focus ${checked ? "bg-primary" : "bg-surface-muted"}`}>
        <span className={`inline-block w-2.5 h-2.5 transform bg-surface rounded-full transition-transform duration-200 ease-in-out ${checked ? "translate-x-[14px]" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

export default function WbsSettingsPanel({ displaySettings, onChange, embedded = false, wbsLevels = null, onClose }) {
  const ds = displaySettings || {};
  const wbs = ds.wbs || {};
  const schemeId = wbs.schemeId || "classic";
  const levels = Array.isArray(wbs.levels) ? wbs.levels : null;
  const isClassic = schemeId === "classic" || !levels;

  const setWbs = (patch) => onChange({ ...ds, wbs: { ...wbs, ...patch } });

  // ── Customise Grouping (batch 19) ──────────────────────────────────────────
  // Stored at the top level of the settings (`displaySettings.grouping`) because
  // grouping is not a colour concern, but its UI lives here — the reference site
  // shows "Customise Grouping" inside its WBS Settings tab too.
  const grouping = cloneGrouping(ds.grouping);
  const [groupingOpen, setGroupingOpen] = useState(true);
  const setGroupingRow = (idx, patch) => {
    const next = grouping.map((g, i) => (i === idx ? { ...g, ...patch } : g));
    onChange({ ...ds, grouping: next });
  };

  // "To Level" options come from the loaded programme (reference behaviour):
  // All Levels + Level 1..deepest level actually present in the file.
  const levelInfo = wbsLevels && wbsLevels.counts ? wbsLevels : wbsLevelCounts([]);
  const levelOptions = wbsLevelOptions(levelInfo.maxLevel);
  const wbsRow = grouping.find(g => (g.groupBy || "wbs") === "wbs") || grouping[0];
  const totalGroups = wbsVisibleGroupCount(levelInfo.counts, "all");
  const visibleGroups = wbsVisibleGroupCount(levelInfo.counts, wbsRow?.toLevel);
  const hiddenGroups = Math.max(0, totalGroups - visibleGroups);
  const levelSummary = `WBS 層級：${levelInfo.maxLevel} 層（${levelInfo.levelList.map(l => `L${l} ${levelInfo.counts[l]}`).join(" ／ ")} 個群組）・目前顯示 ${visibleGroups} 個群組標題${hiddenGroups > 0 ? `（隱藏 ${hiddenGroups} 個）` : ""}${levelInfo.maxLevel <= 1 ? "・此檔案 WBS 只有 1 層，Level 1 與 All Levels 相同" : ""}`;

  const selectScheme = (scheme) => {
    setWbs({ schemeId: scheme.id, levels: levelStylesFromScheme(scheme.id) });
  };

  const setLevel = (idx, patch) => {
    if (!levels) return;
    const next = levels.map((l, i) => (i === idx ? { ...l, ...patch } : { ...l }));
    setWbs({ levels: next });
  };

  const resetLevel = (idx) => {
    const fromScheme = levelStylesFromScheme(schemeId);
    if (levels && fromScheme) setLevel(idx, fromScheme[idx]);
  };

  return (
    <div className={embedded ? "flex flex-col" : "fixed inset-0 bg-black/40 flex justify-end z-50"} onClick={embedded ? undefined : onClose}>
      <div className={embedded ? "bg-surface flex flex-col w-full" : "bg-surface h-full w-[420px] max-w-[95vw] shadow-2xl flex flex-col"} onClick={(e) => e.stopPropagation()}>
        {!embedded && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-surface-subtle">
          <h2 id="gantt-wbs-settings-title" className="text-md font-semibold text-text">WBS Settings</h2>
          <button onClick={onClose} aria-label="Close settings panel"
            className="p-1.5 rounded-full text-text-muted hover:text-text-muted hover:bg-surface-muted">
            <X size={18} />
          </button>
        </div>
        )}

        <div className="flex-grow overflow-y-auto custom-scrollbar p-4">
          {/* ── WBS Row Color Scheme ─────────────────────────────────────── */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text mb-1">WBS Row Color Scheme:</label>
            <div className="max-h-40 overflow-y-auto custom-scrollbar border border-border rounded-md p-[5px] bg-transparent">
              <div className="space-y-1.5">
                {WBS_COLOR_SCHEMES.map((scheme) => {
                  const active = scheme.id === schemeId;
                  return (
                    <button key={scheme.id} onClick={() => selectScheme(scheme)} aria-pressed={active}
                      className={`w-full flex items-center justify-between py-1.5 rounded-md border text-left transition-colors ${
                        active ? "bg-surface-subtle border-primary ring-1 ring-primary" : "bg-surface border-border hover:bg-surface-muted"
                      }`}>
                      <div className="flex items-center space-x-1.5 pl-1">
                        <div className="flex space-x-1">
                          {scheme.swatches.map((c, i) => (
                            <div key={i} className="w-3.5 h-3.5 rounded-sm border border-border" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <span className={`text-xs ${active ? "font-semibold text-primary" : "text-text"}`}>{scheme.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="text-[10px] text-text-muted mt-1">
              Swatches preview WBS level 1 / 4 / 7 — the 7 levels are interpolated from them.
            </div>
          </div>

          {/* ── Toggles ──────────────────────────────────────────────────── */}
          <div className="pt-2 mt-2 border-t border-border">
            <Switch id="gantt-hide-empty-wbs-toggle" label="Hide Empty WBS Rows"
              checked={wbs.hideEmpty !== false} onChange={(v) => setWbs({ hideEmpty: v })}
              title="Hide WBS rows that contain no activities" />
          </div>
          <div className="flex items-center justify-between mb-2 mt-2">
            <Switch id="styled-group-headers-toggle" label="Show Group Headers on Gantt"
              checked={wbs.groupHeadersOnGantt !== false} onChange={(v) => setWbs({ groupHeadersOnGantt: v })}
              title="Draw the WBS row label inside the timeline area" />
          </div>

          {/* ── Customise Grouping (reference: Group By | To Level | Status) ── */}
          <div className="border-t border-border pt-3 mt-3">
            <div className="pb-2">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium text-text">Customise Grouping</h3>
                <button type="button" onClick={() => setGroupingOpen(v => !v)}
                  aria-label={groupingOpen ? "Collapse grouping customisation" : "Expand grouping customisation"}
                  aria-expanded={groupingOpen}
                  title={groupingOpen ? "Collapse" : "Expand"}
                  className="ml-2 p-1 rounded hover:bg-surface-muted focus:outline-none">
                  {groupingOpen
                    ? <ChevronUp size={12} className="text-text-muted" />
                    : <ChevronDown size={12} className="text-text-muted" />}
                </button>
              </div>
            </div>

            {groupingOpen && (
              <div className="pt-1">
                <div className="rounded border border-border bg-surface overflow-x-auto">
                  <div className="grid grid-cols-[60px_minmax(120px,1.8fr)_60px] gap-2 bg-surface-subtle rounded-t px-2 py-1 text-xs font-semibold text-text-muted whitespace-nowrap">
                    <div className="text-left">Group By</div>
                    <div className="text-left">To Level</div>
                    <div className="text-left">Status</div>
                  </div>
                  {grouping.map((row, idx) => (
                    <div key={row.id || idx}
                      className="grid grid-cols-[60px_minmax(120px,1.8fr)_60px] gap-2 border-b border-border items-center px-2 py-1">
                      <div className="font-medium text-text text-[10px] text-left">
                        {row.groupBy === "wbs" ? "WBS" : row.groupBy}
                      </div>
                      <div className="text-left">
                        <select
                          value={String(row.toLevel ?? "all")}
                          onChange={(e) => setGroupingRow(idx, {
                            toLevel: e.target.value === "all" ? "all" : Number(e.target.value),
                          })}
                          disabled={row.enabled === false}
                          aria-label="Group by to level"
                          title={row.enabled === false
                            ? "WBS grouping is off — turn the eye back on to pick a level"
                            : "How many WBS levels are shown as group headers"}
                          className="w-full rounded border border-border bg-surface py-1 px-1.5 text-xs h-7 outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {levelOptions.map(l => (
                            <option key={String(l.value)} value={String(l.value)}>{l.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center text-left">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={row.enabled !== false}
                          aria-label="Enable or disable WBS grouping"
                          title={row.enabled !== false
                            ? "WBS grouping is ON — click to hide all group headers"
                            : "WBS grouping is OFF — click to show the group headers"}
                          onClick={() => setGroupingRow(idx, { enabled: row.enabled === false })}
                          className="cursor-pointer flex items-center justify-center w-5 h-5 rounded focus:outline-none focus:ring-2 focus:ring-focus"
                        >
                          {row.enabled !== false
                            ? <Eye size={12} className="text-primary" />
                            : <EyeOff size={12} className="text-text-muted" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-1 text-[10px] text-text-muted leading-snug">{levelSummary}</div>
                <div className="flex justify-start mt-2">
                  <button type="button" disabled
                    title="Only WBS grouping is available in this app — other grouping sources (resources, activity codes) are not imported yet."
                    className="text-xs text-primary px-0 py-0 bg-transparent border-none shadow-none disabled:text-text-muted disabled:cursor-not-allowed">
                    + Add New Grouping Header
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Custom WBS Level Styles ──────────────────────────────────── */}
          <div className="border-t border-border pt-3 mt-3">
            <h3 className="text-sm font-medium text-text mb-1">Custom WBS Level Styles</h3>
            {isClassic ? (
              <div className="text-[11px] text-text-muted border border-dashed border-border rounded p-2">
                Pick a colour scheme above to style individual WBS levels.
                <span className="text-text-muted"> (Currently using the blue / pink programme-header look.)</span>
              </div>
            ) : (
              <div className="flex pr-1 max-h-[260px] overflow-y-auto custom-scrollbar">
                <div className="space-y-1 w-full">
                  <div className="grid grid-cols-[80px_34px_34px_minmax(70px,1fr)_46px_64px_26px] gap-1.5 items-center px-1 py-0.5 border border-border bg-surface-subtle sticky top-0 z-10"
                    style={{ color: "#333333" }}>
                    {["Level/Group", "BG", "Text", "Font", "Size", "Weight", "Def"].map((h) => (
                      <span key={h} className="text-[10px] font-semibold truncate">{h}</span>
                    ))}
                  </div>
                  {Array.from({ length: WBS_LEVEL_COUNT }).map((_, idx) => {
                    const l = levels[idx] || {};
                    const bg = l.bg || "#ffffff";
                    const text = l.text || wbsTextColorFor(bg);
                    const weight = l.fontWeight || "bold";
                    return (
                      <div key={idx}
                        className="grid grid-cols-[80px_34px_34px_minmax(70px,1fr)_46px_64px_26px] gap-1.5 items-center px-1 py-0.5 border border-border rounded-sm"
                        style={{
                          backgroundColor: bg,
                          fontFamily: l.fontFamily && l.fontFamily !== "inherit" ? l.fontFamily : undefined,
                          fontSize: l.fontSize ? Number(l.fontSize) : 12,
                          fontWeight: weight === "bold" ? 700 : 400,
                          fontStyle: weight === "italic" ? "italic" : "normal",
                        }}>
                        <label className="truncate text-[11px]" style={{ color: text }}>WBS Level {idx + 1}</label>
                        <input type="color" value={bg} onChange={(e) => setLevel(idx, { bg: e.target.value })}
                          className="h-4 w-4 border-none rounded-sm cursor-pointer p-0 bg-transparent"
                          aria-label={`Background colour for WBS level ${idx + 1}`} />
                        <input type="color" value={text} onChange={(e) => setLevel(idx, { text: e.target.value })}
                          className="h-4 w-4 border-none rounded-sm cursor-pointer p-0 bg-transparent"
                          aria-label={`Text colour for WBS level ${idx + 1}`} />
                        <select value={l.fontFamily || "inherit"} onChange={(e) => setLevel(idx, { fontFamily: e.target.value })}
                          className="w-full py-0 px-1 bg-transparent rounded-md focus:outline-none focus:ring-1 focus:ring-focus border-none text-[10px]"
                          style={{ color: text }} aria-label={`Font family for WBS level ${idx + 1}`}>
                          {WBS_FONT_FAMILIES.map((f) => (
                            <option key={f.value} value={f.value} style={{ color: "#333333" }}>{f.label}</option>
                          ))}
                        </select>
                        <input type="number" min="6" max="80" step="1" value={l.fontSize || 12}
                          onChange={(e) => setLevel(idx, { fontSize: Number(e.target.value) || null })}
                          className="w-full text-center text-[11px] bg-surface/90 border border-border rounded focus:outline-none"
                          aria-label={`Font size for WBS level ${idx + 1}`} />
                        <select value={weight} onChange={(e) => setLevel(idx, { fontWeight: e.target.value })}
                          className="w-full py-0 px-1 bg-transparent rounded-md focus:outline-none focus:ring-1 focus:ring-focus border-none text-[10px]"
                          style={{ color: text }} aria-label={`Font style for WBS level ${idx + 1}`}>
                          {WBS_FONT_WEIGHTS.map((f) => (
                            <option key={f.value} value={f.value} style={{ color: "#333333" }}>{f.label}</option>
                          ))}
                        </select>
                        <div className="flex justify-center">
                          <button onClick={() => resetLevel(idx)} title={`Reset WBS level ${idx + 1} to the scheme default`}
                            className="p-1 rounded-full hover:bg-black/10 transition-colors" style={{ color: text }}>
                            <RotateCcw size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

