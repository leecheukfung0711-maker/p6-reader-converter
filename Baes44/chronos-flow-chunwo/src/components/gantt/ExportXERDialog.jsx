import { useState } from "react";
import { X, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildXER, P6_VERSIONS } from "@/lib/exportXER";

export default function ExportXERDialog({ tasks, onClose, xerSource = null }) {
  const today = new Date().toISOString().slice(0, 10);

  // Seed from the imported XER so the defaults reproduce the original file
  const srcProjRow = (xerSource && xerSource.PROJECT && xerSource.PROJECT[0]) || null;
  const srcRootWbs = (xerSource && xerSource.PROJWBS || []).find(r => r.proj_node_flag === "Y") || null;

  const [version, setVersion] = useState("20.12");
  const [projectId, setProjectId] = useState(srcProjRow?.proj_short_name || "PROJ001");
  const [projectName, setProjectName] = useState(srcRootWbs?.wbs_name || "Exported Project");
  const [calendarName, setCalendarName] = useState("Standard");
  const [exportDate, setExportDate] = useState(srcProjRow?.last_recalc_date?.slice(0, 10) || today);

  const handleExport = () => {
    const content = buildXER(tasks, { version, projectId, projectName, calendarName, exportDate, sourceTables: xerSource });
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectId || "export"}.xer`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  const taskCount = tasks.filter(t => !t.isSection).length;
  const sectionCount = tasks.filter(t => t.isSection).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl shadow-2xl p-6 w-[480px] max-w-[95vw]">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-text flex items-center gap-2">
            <FileText size={18} className="text-accent-selected" />
            Export to Primavera P6 XER
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>

        {/* Info */}
        <div className="mb-4 p-3 bg-table-header border border-border rounded-lg text-xs text-accent-selected">
          Exporting <strong>{taskCount}</strong> activities across <strong>{sectionCount}</strong> WBS sections.
        </div>

        {/* Form */}
        <div className="space-y-3">

          {/* P6 Version */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">P6 Version</label>
            <select
              value={version}
              onChange={e => setVersion(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-accessible"
            >
              {P6_VERSIONS.map(v => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
            <p className="text-xs text-text-muted mt-1">
              只影響檔案第一行 ERMHDR 的版本標記；輸出欄位集不分版本、一律完整。
            </p>
          </div>

          {/* Project ID */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Project ID <span className="text-text-muted">(short code, max 20 chars)</span></label>
            <input
              type="text"
              maxLength={20}
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-accessible"
              placeholder="e.g. PROJ001"
            />
          </div>

          {/* Project Name */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-accessible"
              placeholder="Full project name"
            />
          </div>

          {/* Calendar Name */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Calendar Name</label>
            <input
              type="text"
              value={calendarName}
              onChange={e => setCalendarName(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-accessible"
              placeholder="e.g. Standard"
            />
          </div>

          {/* Export Date */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Data Date</label>
            <input
              type="date"
              value={exportDate}
              onChange={e => setExportDate(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-accessible"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            className="bg-accent-accessible hover:bg-accent-accessible text-surface"
            onClick={handleExport}
            disabled={!projectId || !projectName}
          >
            <Download size={14} className="mr-1" />
            Export .xer
          </Button>
        </div>
      </div>
    </div>
  );
}