/**
 * XmlRelationshipEditor.jsx
 * AI-powered tool to add relationships (FF, FS, SF, SS) to P6 XML activities.
 * Accepts: uploaded XML file OR the current exported XML from the app.
 */

import { useState, useRef } from "react";
import { X, Upload, Link2, Loader2, CheckCircle, FileText, Wand2, Trash2, Plus, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { buildP6XML } from "@/lib/exportP6XML";

// ── Parse activities from P6 XML ──────────────────────────────────────────────
function parseActivitiesFromXML(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) return null;

  const activities = [];
  doc.querySelectorAll("Activity").forEach(act => {
    const get = (tag) => act.querySelector(tag)?.textContent?.trim() || "";
    activities.push({
      objectId: get("ObjectId"),
      id: get("Id"),
      name: get("Name"),
      startDate: get("StartDate") || get("PlannedStartDate"),
      finishDate: get("FinishDate") || get("PlannedFinishDate"),
    });
  });
  return activities;
}

// ── Parse existing relationships from XML ────────────────────────────────────
function parseRelationshipsFromXML(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) return [];

  const HOURS_PER_DAY = 8;
  const rels = [];
  doc.querySelectorAll("Relationship").forEach(rel => {
    const get = (tag) => rel.querySelector(tag)?.textContent?.trim() || "";
    const lagHours = parseFloat(get("Lag") || "0");
    rels.push({
      objectId: get("ObjectId"),
      predObjId: get("PredecessorActivityObjectId"),
      succObjId: get("SuccessorActivityObjectId"),
      type: get("Type"),
      lag: Math.round(lagHours / HOURS_PER_DAY), // convert hours → days for display
    });
  });
  return rels;
}

// ── Inject relationships into XML string ──────────────────────────────────────
function injectRelationshipsIntoXML(xmlText, newRels, existingRels, activities) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) return xmlText;

  // Build objectId lookup from activityId
  const actObjByCode = {};
  const actObjByObjId = {};
  activities.forEach(a => {
    actObjByCode[a.id] = a.objectId;
    actObjByObjId[a.objectId] = a;
  });

  // Find highest existing relationship objectId
  let maxRelId = Math.max(0, ...existingRels.map(r => parseInt(r.objectId) || 0));

  // Get all Project elements
  const projects = doc.querySelectorAll("Project");
  if (!projects.length) return xmlText;
  const project = projects[0];

  // Remove existing Relationship nodes from first project (we'll re-inject)
  project.querySelectorAll("Relationship").forEach(r => r.remove());

  // Get project objectId
  const projObjId = project.querySelector("ObjectId")?.textContent?.trim() || "5844";

  // Serialise a Relationship node
  const makeRelNode = (rel, objId) => {
    const ns = "http://xmlns.oracle.com/Primavera/P6Professional/V22.12/API/BusinessObjects";
    const xsi = "http://www.w3.org/2001/XMLSchema-instance";
    const el = doc.createElementNS(ns, "Relationship");
    const c = (tag, val, isNil = false) => {
      const child = doc.createElementNS(ns, tag);
      if (isNil) child.setAttributeNS(xsi, "xsi:nil", "true");
      else child.textContent = val;
      el.appendChild(child);
    };
    const HOURS_PER_DAY = 8;
    c("Comments", "", true);
    // UI stores lag in days; P6 XML expects hours
    c("Lag", String((parseFloat(rel.lag) || 0) * HOURS_PER_DAY));
    c("ObjectId", String(objId));
    c("PredecessorActivityObjectId", rel.predObjId);
    c("PredecessorProjectObjectId", projObjId);
    c("SuccessorActivityObjectId", rel.succObjId);
    c("SuccessorProjectObjectId", projObjId);
    c("Type", rel.type);
    return el;
  };

  // Find ScheduleOptions to insert before it
  const scheduleOptions = project.querySelector("ScheduleOptions");

  // Inject existing + new relationships
  // newRels carry predObjectId/succObjectId directly (from buildCandidates)
  const allRels = [...existingRels, ...newRels.map((r, i) => ({
    ...r,
    predObjId: r.predObjectId || actObjByCode[r.predActivityId] || actObjByCode[r.predId] || r.predId,
    succObjId: r.succObjectId || actObjByCode[r.succActivityId] || actObjByCode[r.succId] || r.succId,
    objectId: String(maxRelId + i + 1),
  }))];

  allRels.forEach((rel, i) => {
    const objId = rel.objectId || (maxRelId + i + 1);
    const node = makeRelNode(rel, objId);
    if (scheduleOptions) project.insertBefore(node, scheduleOptions);
    else project.appendChild(node);
  });

  const serializer = new XMLSerializer();
  return '<?xml version="1.0" encoding="utf-8"?>\n' + serializer.serializeToString(doc).replace(/^<\?xml[^>]*\?>/, "").trim();
}

const REL_TYPES = ["Finish to Start", "Start to Start", "Finish to Finish", "Start to Finish"];
const REL_SHORT = { "Finish to Start": "FS", "Start to Start": "SS", "Finish to Finish": "FF", "Start to Finish": "SF" };
const REL_COLORS = {
  "Finish to Start": "bg-surface-subtle text-primary border-primary",
  "Start to Start":  "bg-surface-subtle text-success border-success",
  "Finish to Finish":"bg-surface-subtle text-primary border-primary",
  "Start to Finish": "bg-table-header text-accent-selected border-accent-accessible",
};

export default function XmlRelationshipEditor({ tasks, exportOpts = {}, onClose, onApplyToGantt }) {
  const [xmlSource, setXmlSource] = useState(null); // "upload" | "current"
  const [xmlText, setXmlText] = useState("");
  const [activities, setActivities] = useState([]);
  const [existingRels, setExistingRels] = useState([]);
  const [newRels, setNewRels] = useState([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [lastAddedCount, setLastAddedCount] = useState(0); // how many were added in last AI run
  const fileRef = useRef();
  const newRelsRef = useRef();

  // Manual add form
  const [manualPred, setManualPred] = useState("");
  const [manualSucc, setManualSucc] = useState("");
  const [manualType, setManualType] = useState("Finish to Start");
  const [manualLag, setManualLag] = useState("0");

  // Prompt suggestions
  const PROMPT_SUGGESTIONS = [
    "Link all activities in sequence with Finish to Start (FS)",
    "Link all activities within each section with FS, lag 0",
    "Add SS relationships for all overlapping activities",
    "Add FF relationships for activities finishing at the same time",
    "Link consecutive activities with FS, skip existing relationships",
    "Chain all delay (DE) activities with FS",
  ];

  function loadXML(text, source) {
    const acts = parseActivitiesFromXML(text);
    if (!acts || acts.length === 0) {
      alert("Could not parse activities from XML. Please check the file format.");
      return;
    }
    const rels = parseRelationshipsFromXML(text);
    setXmlText(text);
    setActivities(acts);
    setExistingRels(rels);
    setNewRels([]);
    setXmlSource(source);
  }

  function handleFileUpload(e) {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => loadXML(ev.target.result, "upload");
    reader.readAsText(f, "utf-8");
  }

  function handleUseCurrent() {
    const generated = buildP6XML(tasks, exportOpts);
    loadXML(generated, "current");
  }

  // ── Pre-compute: build section map + sorted chains + FS candidates ──────────
  // KEY INSIGHT: We work directly from the Gantt `tasks` prop (which has full
  // section structure), NOT from the XML activities alone.
  // This correctly handles duplicate activityIds across two programmes
  // because each Gantt task has a unique `id` regardless of activityId.
  function buildCandidates() {
    if (!tasks || tasks.length === 0) return { sectionMap: {}, candidates: [] };

    // Build a lookup: activityId → list of XML activities (may be multiple with same Id)
    const xmlActsByActId = {};
    activities.forEach(a => {
      const key = (a.id || a.objectId).trim();
      if (!xmlActsByActId[key]) xmlActsByActId[key] = [];
      xmlActsByActId[key].push(a);
    });

    // Walk Gantt tasks in order, keeping per-section position counters
    // so duplicate activityIds are consumed in order across two programmes
    const actIdUsageCount = {};
    const getXmlAct = (activityId) => {
      const key = (activityId || "").trim();
      if (!key || !xmlActsByActId[key]) return null;
      const idx = actIdUsageCount[key] || 0;
      actIdUsageCount[key] = idx + 1;
      return xmlActsByActId[key][idx] || xmlActsByActId[key][xmlActsByActId[key].length - 1];
    };

    // Build per-section rows: [{ taskId, activityId, name, xmlAct, start, end }]
    const sectionMap = {}; // sectionName → array of enriched task entries
    let curSection = "(No Section)";

    tasks.forEach(t => {
      if (t.isSection) {
        curSection = t.activity || "Section";
        return;
      }
      const xmlAct = getXmlAct(t.activityId);
      const entry = {
        taskId: t.id,                             // unique Gantt task id
        predId: `${t.id}`,                        // use task id as relationship key
        activityId: (t.activityId || "").trim(),
        name: t.activity || "",
        objectId: xmlAct?.objectId || "",
        startDate: xmlAct?.startDate || t.start,
        finishDate: xmlAct?.finishDate || t.end,
        section: curSection,
      };
      if (!sectionMap[curSection]) sectionMap[curSection] = [];
      sectionMap[curSection].push(entry);
    });

    // Sort each section by start date
    Object.values(sectionMap).forEach(arr =>
      arr.sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""))
    );

    // Existing rel set (keyed by objectId pairs)
    const existingRelSet = new Set(existingRels.map(r => `${r.predObjId}|${r.succObjId}`));

    // Build candidates: consecutive pairs within each section
    const candidates = [];
    Object.entries(sectionMap).forEach(([section, sorted]) => {
      for (let i = 0; i < sorted.length - 1; i++) {
        const pred = sorted[i];
        const succ = sorted[i + 1];
        if (existingRelSet.has(`${pred.objectId}|${succ.objectId}`)) continue;

        const predFinish = pred.finishDate ? new Date(pred.finishDate.slice(0, 10)) : null;
        const succStart  = succ.startDate  ? new Date(succ.startDate.slice(0, 10))  : null;
        const predStart  = pred.startDate  ? new Date(pred.startDate.slice(0, 10))  : null;
        const succFinish = succ.finishDate ? new Date(succ.finishDate.slice(0, 10)) : null;

        let relType = "Finish to Start";
        let lag = 0;

        if (predFinish && succStart) {
          const gapDays = Math.round((succStart - predFinish) / 86400000);
          if (gapDays < 0 && predStart && succStart) {
            const startDiff  = Math.round((succStart - predStart) / 86400000);
            const finishDiff = predFinish && succFinish ? Math.round((succFinish - predFinish) / 86400000) : 999;
            if (Math.abs(startDiff) <= 1)       { relType = "Start to Start";   lag = startDiff; }
            else if (Math.abs(finishDiff) <= 1) { relType = "Finish to Finish"; lag = finishDiff; }
            else                                { relType = "Finish to Start";  lag = gapDays; }
          } else {
            relType = "Finish to Start";
            lag = gapDays > 0 ? gapDays : 0;
          }
        }

        candidates.push({
          predId: pred.predId,
          succId: succ.predId,
          predObjectId: pred.objectId,
          succObjectId: succ.objectId,
          predActivityId: pred.activityId,
          succActivityId: succ.activityId,
          relType, lag, section,
          predName: `[${pred.activityId}] ${pred.name}`,
          succName: `[${succ.activityId}] ${succ.name}`,
        });
      }
    });

    return { sectionMap, candidates };
  }

  async function handleAIAnalyse() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError("");
    setLastAddedCount(0);
    try {
      const { sectionMap, candidates } = buildCandidates();

      // Detect if user explicitly requested a specific type (FS/SS/FF/SF)
      const typeOverrideMap = {
        "\\bFS\\b": "Finish to Start", "finish.to.start": "Finish to Start",
        "\\bSS\\b": "Start to Start",  "start.to.start":  "Start to Start",
        "\\bFF\\b": "Finish to Finish","finish.to.finish": "Finish to Finish",
        "\\bSF\\b": "Start to Finish", "start.to.finish": "Start to Finish",
      };
      let forcedType = null;
      for (const [pattern, type] of Object.entries(typeOverrideMap)) {
        if (new RegExp(pattern, "i").test(aiPrompt)) { forcedType = type; break; }
      }

      // Build activity list for AI context (from sectionMap, which is task-based)
      const actList = Object.entries(sectionMap).map(([section, acts]) =>
        acts.map(a => `[Section: ${section}] [TaskID:${a.predId}] [ActID:${a.activityId}] ${a.name} | Start: ${a.startDate?.slice(0,10)||"?"} | Finish: ${a.finishDate?.slice(0,10)||"?"}`).join("\n")
      ).join("\n");

      // Pre-computed chain — AI only needs to FILTER, not derive
      const chainList = candidates.map(c =>
        `CANDIDATE: TaskID:${c.predId} (${c.predName}) → TaskID:${c.succId} (${c.succName}) | Type: ${c.relType} | Lag: ${c.lag}d | Section: ${c.section}`
      ).join("\n");

      const existingList = existingRels.map(r => {
        const pred = activities.find(a => a.objectId === r.predObjId);
        const succ = activities.find(a => a.objectId === r.succObjId);
        return `${pred?.id || r.predObjId} → ${succ?.id || r.succObjId} [${REL_SHORT[r.type] || r.type}] Lag:${r.lag}d`;
      }).join("\n");

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a Primavera P6 scheduling expert.

All date calculations are already done. Your ONLY job is to SELECT which CANDIDATES to include based on the user's instruction.

ACTIVITIES (for reference):
${actList}

PRE-COMPUTED CANDIDATES (consecutive pairs sorted by Start Date within each Section):
${chainList || "(none — no consecutive pairs found)"}

EXISTING RELATIONSHIPS (already in file — do NOT duplicate):
${existingList || "(none)"}

USER INSTRUCTION:
"${aiPrompt}"

SELECTION RULES:
1. Match "Section" names and activity names case-insensitively (e.g. "Noise Barrier" matches section or activity containing those words).
2. If the user specifies a relationship type (e.g. "FS"), override the candidate's computed Type with that type; keep computed Lag unless user specifies one.
3. If user says "all" or doesn't filter, include ALL candidates.
4. Only return candidates from the list above — do NOT invent new pairs.
5. Do NOT return pairs already in EXISTING RELATIONSHIPS.

Return the selected relationships as: predId, succId, type, lag (integer), reason (one sentence).`,
        response_json_schema: {
          type: "object",
          properties: {
            relationships: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  predId: { type: "string" },
                  succId: { type: "string" },
                  type: { type: "string" },
                  lag: { type: "number" },
                  reason: { type: "string" },
                }
              }
            }
          }
        },
        model: "gemini_3_1_pro",
        add_context_from_internet: false,
      });

      // Build candidate lookup by predId key for fast matching
      const candidateMap = {};
      candidates.forEach(c => { candidateMap[`${c.predId}|${c.succId}`] = c; });

      const suggested = (result?.relationships || [])
        .map(r => {
          // AI returns TaskID:xxx — strip prefix if present
          const predId = String(r.predId).replace(/^TaskID:/i, "");
          const succId = String(r.succId).replace(/^TaskID:/i, "");
          const cand = candidateMap[`${predId}|${succId}`];
          if (!cand) return null;
          const type = forcedType || (REL_TYPES.includes(r.type) ? r.type : cand.relType);
          return {
            predId,
            succId,
            predObjectId: cand.predObjectId,
            succObjectId: cand.succObjectId,
            predActivityId: cand.predActivityId,
            succActivityId: cand.succActivityId,
            type,
            lag: r.lag ?? cand.lag ?? 0,
            reason: r.reason || "",
          };
        })
        .filter(Boolean);

      setNewRels(prev => {
        const existing = new Set(prev.map(r => `${r.predId}|${r.succId}|${r.type}`));
        const toAdd = suggested.filter(r => !existing.has(`${r.predId}|${r.succId}|${r.type}`));
        setLastAddedCount(toAdd.length);
        // Scroll to results after state update
        setTimeout(() => newRelsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
        return [...prev, ...toAdd];
      });
    } catch (e) {
      setAiError("AI analysis failed: " + e.message);
    } finally {
      setAiLoading(false);
    }
  }

  function addManual() {
    if (!manualPred || !manualSucc) return;
    if (manualPred === manualSucc) return;
    setNewRels(prev => [...prev, { predId: manualPred, succId: manualSucc, type: manualType, lag: parseInt(manualLag) || 0, reason: "Manually added" }]);
    setManualPred(""); setManualSucc("");
  }

  function removeNewRel(idx) {
    setNewRels(prev => prev.filter((_, i) => i !== idx));
    setLastAddedCount(0);
  }

  function handleApplyToGantt() {
    if (!onApplyToGantt || newRels.length === 0) return;
    // predId/succId are now Gantt task ids (numeric strings) — direct mapping
    const updates = {};
    newRels.forEach(r => {
      const predTaskId = Number(r.predId);
      const succTaskId = Number(r.succId);
      if (!predTaskId || !succTaskId) return;
      updates[predTaskId] = { link: succTaskId, linkOffset: r.lag || 0, linkType: REL_SHORT[r.type] || r.type || "FS" };
    });

    if (Object.keys(updates).length === 0) {
      alert("Could not apply relationships. Please try again.");
      return;
    }

    onApplyToGantt(updates);
    onClose();
  }

  function handleDownload() {
    const output = injectRelationshipsIntoXML(xmlText, newRels, existingRels, activities);
    const blob = new Blob([output], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export_with_relationships.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // For display: map taskId → task info (built from tasks prop)
  const actById = {};
  if (tasks) {
    tasks.forEach(t => {
      if (!t.isSection) actById[String(t.id)] = { name: t.activity, id: t.activityId };
    });
  }

  function removeExistingRel(idx) {
    setExistingRels(prev => prev.filter((_, i) => i !== idx));
  }

  function updateExistingRel(idx, field, value) {
    setExistingRels(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl flex flex-col" style={{ width: 900, maxWidth: "98vw", maxHeight: "94vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Link2 size={18} className="text-surface" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text">XML Relationship Editor</h2>
              <p className="text-xs text-text-muted">Add FS / SS / FF / SF relationships to P6 XML activities using AI</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Load XML ─────────────────────────────────────────── */}
          {!xmlSource ? (
            <div className="p-6">
              <h3 className="text-sm font-semibold text-text mb-4 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-surface-subtle text-primary text-xs flex items-center justify-center font-bold">1</span>
                Load P6 XML File
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Upload */}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 hover:border-primary hover:bg-surface-subtle transition-all cursor-pointer text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-surface-subtle flex items-center justify-center">
                    <Upload size={22} className="text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-text">Upload XML File</div>
                    <div className="text-xs text-text-muted mt-0.5">Select a P6 PMXML file from your computer</div>
                  </div>
                </button>
                <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={handleFileUpload} />

                {/* Use current */}
                <button
                  onClick={handleUseCurrent}
                  className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 hover:border-success hover:bg-surface-subtle transition-all cursor-pointer text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-surface-subtle flex items-center justify-center">
                    <FileText size={22} className="text-success" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-text">Use Current Export</div>
                    <div className="text-xs text-text-muted mt-0.5">Generate XML from current Gantt data and edit relationships</div>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">

              {/* Status bar */}
              <div className="flex items-center gap-3 p-3 bg-surface-subtle border border-border rounded-xl">
                <CheckCircle size={16} className="text-primary flex-shrink-0" />
                <div className="flex-1 text-xs text-primary">
                  <strong>{activities.length}</strong> activities loaded &nbsp;·&nbsp;
                  <strong>{existingRels.length}</strong> existing relationships &nbsp;·&nbsp;
                  <strong className="text-success">{newRels.length}</strong> new to add
                </div>
                <button
                  onClick={() => { setXmlSource(null); setXmlText(""); setActivities([]); setExistingRels([]); setNewRels([]); }}
                  className="text-xs text-primary hover:underline"
                >
                  Change file
                </button>
              </div>

              {/* ── Step 2: AI Instruction ───────────────────────────────── */}
              <div>
                <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-surface-subtle text-primary text-xs flex items-center justify-center font-bold">2</span>
                  AI Relationship Generator
                </h3>
                {/* Quick suggestion chips */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PROMPT_SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setAiPrompt(s)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                        aiPrompt === s
                          ? "bg-primary text-surface border-primary"
                          : "bg-surface text-text-muted border-border hover:border-primary hover:text-primary"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="border border-border rounded-xl overflow-hidden">
                  <textarea
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder={`Or type your own instruction, e.g. "Add SS between A1000 and A1010 with 5 day lag"`}
                    className="w-full p-4 text-sm text-text resize-none focus:outline-none"
                    style={{ minHeight: 80 }}
                  />
                  <div className="flex items-center justify-between px-4 py-2 bg-surface-subtle border-t border-border">
                    {aiError && <span className="text-xs text-danger">{aiError}</span>}
                    {!aiError && <span className="text-xs text-text-muted">AI will suggest relationships — you can review before downloading</span>}
                    <Button
                      size="sm"
                      disabled={!aiPrompt.trim() || aiLoading}
                      onClick={handleAIAnalyse}
                      className="bg-primary hover:bg-primary-active text-surface flex-shrink-0"
                    >
                      {aiLoading ? <><Loader2 size={13} className="animate-spin mr-1" /> Analysing...</> : <><Wand2 size={13} className="mr-1" /> Generate</>}
                    </Button>
                  </div>
                </div>
              </div>

              {/* ── Step 3: Manual Add ──────────────────────────────────── */}
              <div>
                <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-surface-subtle text-primary text-xs flex items-center justify-center font-bold">3</span>
                  Add Relationship Manually
                </h3>
                <div className="flex gap-2 items-end flex-wrap">
                  <div className="flex-1 min-w-32">
                    <label className="block text-xs text-text-muted mb-1">Predecessor ID</label>
                    <select value={manualPred} onChange={e => setManualPred(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-focus">
                      <option value="">Select...</option>
                      {activities.map(a => <option key={a.objectId} value={a.id}>{a.id} — {a.name.slice(0,40)}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 min-w-32">
                    <label className="block text-xs text-text-muted mb-1">Successor ID</label>
                    <select value={manualSucc} onChange={e => setManualSucc(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-focus">
                      <option value="">Select...</option>
                      {activities.map(a => <option key={a.objectId} value={a.id}>{a.id} — {a.name.slice(0,40)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Type</label>
                    <select value={manualType} onChange={e => setManualType(e.target.value)}
                      className="border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-focus">
                      {REL_TYPES.map(t => <option key={t} value={t}>{REL_SHORT[t]} — {t}</option>)}
                    </select>
                  </div>
                  <div style={{ width: 70 }}>
                    <label className="block text-xs text-text-muted mb-1">Lag (d)</label>
                    <input type="number" value={manualLag} onChange={e => setManualLag(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-focus" />
                  </div>
                  <Button size="sm" onClick={addManual} disabled={!manualPred || !manualSucc || manualPred === manualSucc}
                    className="bg-primary-dark hover:bg-primary-dark text-surface">
                    <Plus size={13} className="mr-1" /> Add
                  </Button>
                </div>
              </div>

              {/* ── New Relationships List ──────────────────────────────── */}
              {newRels.length > 0 && (
                <div ref={newRelsRef}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-surface-subtle text-success text-xs flex items-center justify-center font-bold">{newRels.length}</span>
                      New Relationships to Add
                    </h3>
                    {lastAddedCount > 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-surface-subtle border border-success rounded-full text-xs text-success font-semibold">
                        <Sparkles size={10} />+{lastAddedCount} just added by AI
                      </span>
                    )}
                  </div>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-surface-subtle border-b border-border">
                          <th className="text-left px-3 py-2 font-semibold text-text-muted">Predecessor</th>
                          <th className="text-left px-3 py-2 font-semibold text-text-muted">Successor</th>
                          <th className="px-3 py-2 font-semibold text-text-muted text-center">Type</th>
                          <th className="px-3 py-2 font-semibold text-text-muted text-center">Lag</th>
                          <th className="text-left px-3 py-2 font-semibold text-text-muted">Reason</th>
                          <th className="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {newRels.map((r, i) => {
                          const pred = actById[String(r.predId)];
                          const succ = actById[String(r.succId)];
                          const isNew = lastAddedCount > 0 && i >= newRels.length - lastAddedCount;
                          return (
                            <tr key={i} className={isNew ? "bg-surface-subtle border-l-2 border-success" : i % 2 === 0 ? "bg-surface" : "bg-surface-subtle/50"}>
                              <td className="px-3 py-2">
                                <div className="font-mono text-primary font-semibold">{pred?.id || r.predActivityId || r.predId}</div>
                                <div className="text-text-muted truncate" style={{ maxWidth: 180 }}>{pred?.name}</div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-mono text-primary font-semibold">{succ?.id || r.succActivityId || r.succId}</div>
                                <div className="text-text-muted truncate" style={{ maxWidth: 180 }}>{succ?.name}</div>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-bold ${REL_COLORS[r.type] || "bg-surface-muted text-text"}`}>
                                  {REL_SHORT[r.type] || r.type}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center text-text-muted">{r.lag || 0}d</td>
                              <td className="px-3 py-2 text-text-muted italic truncate" style={{ maxWidth: 160 }}>{r.reason}</td>
                              <td className="px-2 py-2 text-center">
                                <button onClick={() => removeNewRel(i)} className="text-danger hover:text-danger">
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Existing Relationships (editable) ──────────────────── */}
              {existingRels.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
                    Existing Relationships ({existingRels.length})
                    <span className="text-xs font-normal text-text-muted">— click to edit type / lag, or delete</span>
                  </h3>
                  <div className="border border-border rounded-xl overflow-auto max-h-52">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-surface-subtle border-b border-border">
                          <th className="text-left px-3 py-2 font-semibold text-text-muted">Predecessor</th>
                          <th className="text-left px-3 py-2 font-semibold text-text-muted">Successor</th>
                          <th className="px-3 py-2 font-semibold text-text-muted text-center">Type</th>
                          <th className="px-3 py-2 font-semibold text-text-muted text-center">Lag</th>
                          <th className="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {existingRels.map((r, i) => {
                          const pred = activities.find(a => a.objectId === r.predObjId);
                          const succ = activities.find(a => a.objectId === r.succObjId);
                          return (
                            <tr key={i} className={i % 2 === 0 ? "bg-surface" : "bg-surface-subtle/50"}>
                              <td className="px-3 py-1.5">
                                <div className="font-mono text-primary font-semibold">{pred?.id || r.predObjId}</div>
                                <div className="text-text-muted truncate" style={{ maxWidth: 160 }}>{pred?.name}</div>
                              </td>
                              <td className="px-3 py-1.5">
                                <div className="font-mono text-primary font-semibold">{succ?.id || r.succObjId}</div>
                                <div className="text-text-muted truncate" style={{ maxWidth: 160 }}>{succ?.name}</div>
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <select
                                  value={r.type}
                                  onChange={e => updateExistingRel(i, "type", e.target.value)}
                                  className="border border-border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-focus bg-surface"
                                >
                                  {REL_TYPES.map(t => <option key={t} value={t}>{REL_SHORT[t]}</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <input
                                  type="number"
                                  value={r.lag}
                                  onChange={e => updateExistingRel(i, "lag", e.target.value)}
                                  className="w-14 border border-border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-focus"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <button onClick={() => removeExistingRel(i)} className="text-danger hover:text-danger">
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          {xmlSource && (
            <div className="flex items-center gap-2">
              {newRels.length > 0 && onApplyToGantt && (
                <Button
                  size="sm"
                  onClick={handleApplyToGantt}
                  className="bg-success hover:bg-primary-dark text-surface"
                >
                  <Link2 size={14} className="mr-1.5" />
                  Apply to Gantt ({newRels.length} links)
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleDownload}
                disabled={activities.length === 0}
                className="bg-primary hover:bg-primary-active text-surface"
              >
                <Download size={14} className="mr-1.5" />
                Download XML ({existingRels.length + newRels.length} rels)
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}