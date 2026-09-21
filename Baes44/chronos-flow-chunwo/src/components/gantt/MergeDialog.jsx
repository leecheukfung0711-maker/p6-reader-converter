import { useState, useMemo } from "react";
import { X, Loader2, Brain, CheckCircle, XCircle, RefreshCw, Undo2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { parseISO, isValid, format } from "date-fns";

function groupByProgramme(tasks) {
  const groups = [];
  let current = null;
  tasks.forEach(t => {
    if (t.isSection) {
      current = { section: t, rows: [] };
      groups.push(current);
    } else if (current && !t.merged) {
      current.rows.push(t);
    }
  });
  return groups;
}

const MERGE_SCHEMA = {
  type: "object",
  properties: {
    groups: {
      type: "array",
      items: {
        type: "object",
        properties: {
          taskIds:           { type: "array", items: { type: "number" } },
          suggestedActivity: { type: "string" },
          suggestedId:       { type: "string" },
          mergeReason:       { type: "string" },
          confidence:        { type: "number" },
        }
      }
    }
  }
};

export default function MergeDialog({ tasks, setTasks, saveToHistory, onClose }) {
  const [step, setStep] = useState("idle");
  const [proposals, setProposals] = useState([]);
  const [selectedProgramme, setSelectedProgramme] = useState("all");

  const programmes = useMemo(() => groupByProgramme(tasks), [tasks]);
  const existingMerges = useMemo(() => tasks.filter(t => t.isMergeResult), [tasks]);

  const analyse = async () => {
    setStep("analyzing");

    let targetGroups = programmes;
    if (selectedProgramme !== "all") {
      targetGroups = programmes.filter(g => g.section?.id === Number(selectedProgramme));
    }

    const taskList = targetGroups.flatMap(g =>
      g.rows.map(t => ({
        id: t.id,
        activity: t.activity,
        activityId: t.activityId,
        start: t.start,
        end: t.end,
        barType: t.barType,
        programme: g.section?.activity || "Default",
      }))
    );

    if (taskList.length < 2) {
      setStep("idle");
      return;
    }

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a construction project Gantt chart expert. Analyse the following tasks and identify groups that should be merged — tasks representing the same type of work split across multiple rows (e.g. same activity at different locations, sequential phases of the same element).

Tasks JSON:
${JSON.stringify(taskList, null, 2)}

RULES:
- Only merge tasks within the SAME programme (same "programme" field).
- Each group must contain at least 2 tasks.
- Be conservative: only suggest merging when confidence > 0.7.
- suggestedActivity: concise merged name (remove part A/B/location suffixes if repeated).
- suggestedId: combine IDs with "/" or use base prefix.
- Do NOT merge tasks that are clearly different activities.
- List EXACT numeric task IDs.`,
      response_json_schema: MERGE_SCHEMA,
    });

    const rawGroups = result?.groups || [];
    const validProposals = rawGroups
      .filter(g => Array.isArray(g.taskIds) && g.taskIds.length >= 2)
      .map((g, i) => ({
        id: `proposal-${i}`,
        taskIds: g.taskIds,
        newActivity: g.suggestedActivity || "",
        newId: g.suggestedId || "",
        reason: g.mergeReason || "",
        confidence: g.confidence ?? 0.8,
        accepted: true,
      }))
      .filter(p => p.taskIds.every(id => tasks.find(t => t.id === id && !t.merged)));

    setProposals(validProposals);
    setStep("proposals");
  };

  const confirmMerges = () => {
    saveToHistory && saveToHistory(tasks);
    let updated = [...tasks];
    let newId = Math.max(...tasks.map(t => t.id)) + 1;

    proposals.filter(p => p.accepted).forEach(proposal => {
      const sourceTasks = proposal.taskIds
        .map(id => updated.find(t => t.id === id))
        .filter(Boolean);
      if (sourceTasks.length < 2) return;

      const starts = sourceTasks.map(t => t.start).filter(Boolean).map(s => parseISO(s)).filter(isValid);
      const ends   = sourceTasks.map(t => t.end).filter(Boolean).map(e => parseISO(e)).filter(isValid);
      const mergedStart = starts.length ? format(new Date(Math.min(...starts.map(d => d.getTime()))), "yyyy-MM-dd") : "";
      const mergedEnd   = ends.length   ? format(new Date(Math.max(...ends.map(d => d.getTime()))),   "yyyy-MM-dd") : "";

      // Mark originals hidden
      updated = updated.map(t =>
        proposal.taskIds.includes(t.id) ? { ...t, merged: true } : t
      );

      // Insert merged task right after the last source task
      const lastSourceId = proposal.taskIds[proposal.taskIds.length - 1];
      const insertIdx = updated.findIndex(t => t.id === lastSourceId);
      const mergedTask = {
        id: newId++,
        activity: proposal.newActivity,
        activityId: proposal.newId,
        start: mergedStart,
        end: mergedEnd,
        barType: sourceTasks[0]?.barType || "baseline",
        isMergeResult: true,
        mergedFromIds: proposal.taskIds,
      };
      updated.splice(insertIdx + 1, 0, mergedTask);
    });

    setTasks(updated);
    onClose();
  };

  const revertMerge = (mergeResultId) => {
    saveToHistory && saveToHistory(tasks);
    setTasks(prev => {
      const mergeResult = prev.find(t => t.id === mergeResultId);
      if (!mergeResult) return prev;
      return prev
        .map(t => mergeResult.mergedFromIds?.includes(t.id) ? { ...t, merged: false } : t)
        .filter(t => t.id !== mergeResultId);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl shadow-2xl p-6" style={{ width: 660, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-text flex items-center gap-2">
            <Brain size={18} className="text-primary" /> Smart Merge
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>

        {/* Existing merges */}
        {existingMerges.length > 0 && step !== "proposals" && (
          <div className="mb-4 border border-border bg-table-header rounded-lg p-3">
            <h3 className="text-xs font-semibold text-accent-selected mb-2">Current Merges ({existingMerges.length})</h3>
            <div className="space-y-1.5">
              {existingMerges.map(m => (
                <div key={m.id} className="flex items-center justify-between bg-surface border border-border rounded px-3 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-text truncate">{m.activity || "(unnamed)"}</span>
                    <span className="text-xs text-text-muted font-mono flex-shrink-0">{m.activityId}</span>
                    <span className="text-xs text-accent-selected flex-shrink-0">← {m.mergedFromIds?.length || 0} tasks</span>
                    <span className="text-xs text-text-muted flex-shrink-0">{m.start} → {m.end}</span>
                  </div>
                  <button
                    onClick={() => revertMerge(m.id)}
                    className="flex items-center gap-1 text-xs text-danger hover:text-danger px-2 py-0.5 rounded border border-border hover:bg-surface-subtle ml-2 flex-shrink-0"
                  >
                    <Undo2 size={11} /> Revert
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Idle: scope + analyse */}
        {step === "idle" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Analyse Programme</label>
              <select
                value={selectedProgramme}
                onChange={e => setSelectedProgramme(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
              >
                <option value="all">All Programmes</option>
                {programmes.filter(g => g.section).map(g => (
                  <option key={g.section.id} value={g.section.id}>{g.section.activity}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-text-muted">
              AI will analyse tasks within each programme and suggest merges based on semantic similarity — same work type, similar activity names, sequential phases.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" className="bg-primary hover:bg-primary-active text-surface" onClick={analyse}>
                <Brain size={14} className="mr-1" /> Analyse
              </Button>
            </div>
          </div>
        )}

        {/* Analyzing */}
        {step === "analyzing" && (
          <div className="text-center py-10">
            <Loader2 size={32} className="animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-text-muted">AI is analysing tasks for merge candidates…</p>
            <p className="text-xs text-text-muted mt-1">This may take 10–20 seconds.</p>
          </div>
        )}

        {/* Preview / Final Confirmation */}
        {step === "preview" && (() => {
          const accepted = proposals.filter(p => p.accepted);
          return (
            <div>
              <div className="flex items-center gap-2 mb-3 p-3 bg-table-header border border-border rounded-lg">
                <AlertTriangle size={16} className="text-accent-selected flex-shrink-0" />
                <p className="text-xs text-accent-selected">
                  The following <strong>{accepted.length}</strong> merge(s) will be applied. Source tasks will be hidden from view and the merged task inserted in their place.
                </p>
              </div>

              <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
                {accepted.map((p, pi) => {
                  const sourceTasks = p.taskIds.map(id => tasks.find(t => t.id === id)).filter(Boolean);
                  const starts = sourceTasks.map(t => t.start).filter(Boolean);
                  const ends   = sourceTasks.map(t => t.end).filter(Boolean);
                  const mergedStart = starts.length ? starts.reduce((a,b) => a < b ? a : b) : "";
                  const mergedEnd   = ends.length   ? ends.reduce((a,b) => a > b ? a : b) : "";

                  return (
                    <div key={p.id} className="border border-border rounded-lg overflow-hidden">
                      {/* Merged result (top) */}
                      <div className="bg-primary text-surface px-3 py-2 flex items-center justify-between">
                        <div className="min-w-0">
                          <span className="text-xs font-bold block truncate">{p.newActivity || "(unnamed)"}</span>
                          <span className="text-xs font-mono text-primary">{p.newId}</span>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <span className="text-xs text-primary block">{mergedStart}</span>
                          <span className="text-xs text-primary block">→ {mergedEnd}</span>
                        </div>
                      </div>
                      {/* Source tasks (below, as hidden list) */}
                      <div className="bg-surface divide-y divide-border">
                        {sourceTasks.map(t => (
                          <div key={t.id} className="px-3 py-1.5 flex items-center gap-2 opacity-60">
                            <span className="text-text-muted text-xs">↑</span>
                            <span className="text-xs font-mono text-text-muted w-28 truncate flex-shrink-0">{t.activityId}</span>
                            <span className="text-xs text-text-muted truncate flex-1">{t.activity}</span>
                            <span className="text-xs text-text-muted flex-shrink-0">{t.start}~{t.end}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep("proposals")}>
                  ← Back to Edit
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary-active text-surface"
                    onClick={confirmMerges}
                  >
                    <CheckCircle size={14} className="mr-1" />
                    Confirm {accepted.length} Merge(s)
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Proposals */}
        {step === "proposals" && (
          <div>
            {proposals.length === 0 ? (
              <div className="text-center py-10 text-text-muted">
                <CheckCircle size={32} className="mx-auto mb-3 text-success" />
                <p className="text-sm">No merge candidates found — tasks look well-defined already.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setStep("idle")}>Back</Button>
              </div>
            ) : (
              <>
                <p className="text-xs text-text-muted mb-3">
                  {proposals.length} proposal(s) found. Toggle ✓/✗ to accept or skip each. Edit the merged Activity and ID before confirming.
                </p>
                <div className="space-y-3 mb-4">
                  {proposals.map((p, pi) => {
                    const sourceTasks = p.taskIds.map(id => tasks.find(t => t.id === id)).filter(Boolean);
                    const starts = sourceTasks.map(t => t.start).filter(Boolean);
                    const ends   = sourceTasks.map(t => t.end).filter(Boolean);
                    const mergedStart = starts.length ? starts.reduce((a,b) => a < b ? a : b) : "";
                    const mergedEnd   = ends.length   ? ends.reduce((a,b) => a > b ? a : b) : "";

                    const toggle = () => setProposals(prev => prev.map((pp, i) => i === pi ? { ...pp, accepted: !pp.accepted } : pp));
                    const update = (field, val) => setProposals(prev => prev.map((pp, i) => i === pi ? { ...pp, [field]: val } : pp));

                    return (
                      <div key={p.id} className={`border rounded-lg p-3 transition-all ${p.accepted ? "border-primary bg-surface-subtle" : "border-border bg-surface-subtle opacity-55"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <button onClick={toggle}>
                            {p.accepted
                              ? <CheckCircle size={16} className="text-primary" />
                              : <XCircle size={16} className="text-text-muted" />}
                          </button>
                          <span className="text-xs font-semibold text-text">Merge {sourceTasks.length} tasks</span>
                          <span className="text-xs text-surface bg-primary rounded px-1.5 py-0.5 font-mono">
                            {Math.round((p.confidence || 0.8) * 100)}%
                          </span>
                        </div>

                        {/* Source tasks list */}
                        <div className="space-y-0.5 mb-2 pl-5">
                          {sourceTasks.map(t => (
                            <div key={t.id} className="flex items-center gap-2 text-xs text-text-muted">
                              <span className="text-text-muted">↳</span>
                              <span className="font-mono text-text-muted w-28 truncate flex-shrink-0">{t.activityId}</span>
                              <span className="truncate">{t.activity}</span>
                              <span className="text-text-muted flex-shrink-0 text-xs">{t.start} → {t.end}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProposals(prev => prev.map((pp, i) => {
                                    if (i !== pi) return pp;
                                    const newTaskIds = pp.taskIds.filter(id => id !== t.id);
                                    return { ...pp, taskIds: newTaskIds };
                                  }).filter(pp => pp.taskIds.length >= 2));
                                }}
                                className="text-danger hover:text-danger hover:bg-surface-subtle rounded p-0.5 flex-shrink-0"
                                title="Remove from merge"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>

                        <p className="text-xs text-primary italic mb-2 pl-5">{p.reason}</p>

                        {/* Editable merged result */}
                        <div className="bg-surface border border-border rounded p-2 space-y-1.5">
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-xs text-text-muted mb-0.5 block">Merged Activity</label>
                              <input
                                type="text"
                                value={p.newActivity}
                                onChange={e => update("newActivity", e.target.value)}
                                className="w-full border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-focus"
                              />
                            </div>
                            <div style={{ width: 170 }}>
                              <label className="text-xs text-text-muted mb-0.5 block">Merged ID</label>
                              <input
                                type="text"
                                value={p.newId}
                                onChange={e => update("newId", e.target.value)}
                                className="w-full border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-focus"
                              />
                            </div>
                          </div>
                          <p className="text-xs text-text-muted">
                            Result period: <span className="font-medium text-text-muted">{mergedStart} → {mergedEnd}</span>
                          </p>
                        </div>

                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStep("idle")}>
                    <RefreshCw size={12} className="mr-1" /> Re-analyse
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary-active text-surface"
                      onClick={() => setStep("preview")}
                      disabled={!proposals.some(p => p.accepted)}
                    >
                      <CheckCircle size={14} className="mr-1" />
                      Preview {proposals.filter(p => p.accepted).length} Merge(s) →
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}