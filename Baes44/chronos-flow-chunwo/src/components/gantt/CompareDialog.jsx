/**
 * CompareDialog.jsx
 * Compare Version A (current Gantt) with Version B (uploaded file)
 * Support Excel, XER, XML formats - reuse existing parsing logic
 */

import { useState, useRef, useMemo, useEffect } from "react";
import { X, Upload, FileText, GitCompare, CheckCircle, AlertCircle, TrendingUp, TrendingDown, Shuffle } from "lucide-react";
import { countWorkingDays, addWorkingDays } from "@/lib/hkWorkingDays";
import { Button } from "@/components/ui/button";
import { parseExcelFile, parseXMLFile } from "@/components/gantt/ImageImportDialog";
import { parseXER } from "@/lib/parseXER";
import { base44 } from "@/api/base44Client";

const DIFF_TYPES = {
  DELAYED:  { label: "Delayed",  color: "bg-table-header text-accent-selected border-border",  icon: TrendingUp },
  EARLIER:  { label: "Earlier",  color: "bg-surface-subtle text-primary border-border",            icon: TrendingDown },
  NEW:      { label: "New Task", color: "bg-surface-subtle text-success border-border", icon: null },
  CHANGED:  { label: "Changed",  color: "bg-table-header text-accent-selected border-border",      icon: Shuffle },
};

function DiffBadge({ type }) {
  const cfg = DIFF_TYPES[type] || DIFF_TYPES.CHANGED;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${cfg.color}`}>
      {Icon && <Icon size={10} />}
      {cfg.label}
    </span>
  );
}

export default function CompareDialog({ tasks, saveToHistory, onApplyChanges, onClose, onReplaceWithVersionA }) {
  const [step, setStep] = useState(1); // 1: upload, 2: review
  const [versionATasksFromFile, setVersionATasksFromFile] = useState(null); // from file upload
  const [versionAFile, setVersionAFile] = useState(null);
  const [versionBTasks, setVersionBTasks] = useState([]);
  const [versionBFile, setVersionBFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parseTarget, setParseTarget] = useState("B"); // "A" or "B"
  const [manualMatches, setManualMatches] = useState({}); // versionB index → versionA task id
  const fileARef = useRef();
  const fileBRef = useRef();
  const [dragOverA, setDragOverA] = useState(false);
  const [dragOverB, setDragOverB] = useState(false);
  const [textInputMode, setTextInputMode] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [aiAnalysing, setAiAnalysing] = useState(false);
  const [aiMatching, setAiMatching] = useState(false);
  const [aiMatchResult, setAiMatchResult] = useState("");
  const autoMatchTriggeredRef = useRef(""); // signature to prevent re-triggering

  // Version A = from file if uploaded, otherwise current Gantt tasks (non-section only)
  const versionATasks = useMemo(() => {
    if (versionATasksFromFile) return versionATasksFromFile.filter(t => !t.isSection);
    return tasks.filter(t => !t.isSection);
  }, [versionATasksFromFile, tasks]);
  const versionASections = useMemo(() => {
    if (versionATasksFromFile) return versionATasksFromFile.filter(t => t.isSection);
    return tasks.filter(t => t.isSection);
  }, [versionATasksFromFile, tasks]);

  // Build lookup: activityId (trimmed, lowercase) → task
  const versionALookup = useMemo(() => {
    const lookup = {};
    versionATasks.forEach(t => {
      const key = (t.activityId || "").trim().toLowerCase();
      if (key) lookup[key] = t;
    });
    return lookup;
  }, [versionATasks]);

  // Build WBS section map: taskId → WBS section name (for display in dropdown)
  const versionAWbsMap = useMemo(() => {
    const sourceA = versionATasksFromFile || tasks;
    let currentSection = "";
    const map = {};
    sourceA.forEach(t => {
      if (t.isSection) {
        currentSection = t.activity || "";
      } else if (t.id != null) {
        map[t.id] = currentSection;
      }
    });
    return map;
  }, [versionATasksFromFile, tasks]);

  // Parse uploaded file (shared function for both Version A and B)
  async function parseFile(file, target) {
    let parsed = [];
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "xlsx" || ext === "xls") {
      parsed = await parseExcelFile(file);
      // Check if this is a duration change format (Activity ID, Activity Name, New Duration)
      if (parsed.length > 0 && parsed[0].newDuration !== undefined) {
        // This is a duration change file - will be processed in handleFileUpload
        return parsed;
      }
    } else if (ext === "xer") {
      const text = await file.text();
      parsed = parseXER(text);
    } else if (ext === "xml") {
      const text = await file.text();
      parsed = await parseXMLFile(text);
    } else if (ext === "pdf") {
      // PDF - use AI to extract text and parse
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let allText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        allText += content.items.map(item => item.str).join(" ") + "\n";
      }
      if (allText.length < 100) {
        throw new Error("Could not extract text from this PDF. It may be a scanned image.");
      }
      const extracted = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract ALL schedule/programme data from the following text into a structured Gantt chart format. Return ALL rows including section headers and activity rows.

SECTION HEADERS: rows that are programme/section titles - set is_section=true, put the title in "activity", leave start/end null, section_type="blue".
ACTIVITY ROWS: rows with activity name and/or dates - set is_section=false.
activity_id = P6 activity code or any ID column. item = item number on Gantt bar (e.g. A1, B2). bar_type = "delay" if delay event, otherwise "baseline".
Convert ALL dates to YYYY-MM-DD format (e.g. "02-Oct-22" → "2022-10-02").

ACTUAL DATE HANDLING — CRITICAL:
- If the PDF has "Actual Start" / "Actual Finish" columns, OR dates marked with "A" suffix or red text, these are ACTUAL dates.
- Put actual dates into start/end fields AND set start_actual=true / end_actual=true.
- If both planned and actual dates exist, use the ACTUAL date as start/end (with start_actual=true), and put the planned date into baseline_start/baseline_finish.
- If only planned dates exist (no actual), set start_actual=false / end_actual=false.
- Date values may have a trailing "A" letter suffix (e.g. "10-Nov-21 A") — strip the "A" suffix and set start_actual=true or end_actual=true.

Text content:
${allText.substring(0, 24000)}`,
        response_json_schema: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  is_section: { type: "boolean" },
                  section_type: { type: "string" },
                  activity: { type: "string" },
                  activity_id: { type: "string" },
                  item: { type: "string" },
                  start: { type: "string" },
                  end: { type: "string" },
                  start_actual: { type: "boolean" },
                  end_actual: { type: "boolean" },
                  baseline_start: { type: "string" },
                  baseline_finish: { type: "string" },
                  bar_type: { type: "string" },
                }
              }
            }
          }
        },
        model: "gemini_3_1_pro",
      });
      parsed = (extracted?.tasks || []).map(t => ({
        isSection: !!t.is_section,
        sectionType: t.section_type || "blue",
        activity: t.activity || "",
        activityId: t.activity_id || "",
        item: t.item || undefined,
        start: t.start || "",
        end: t.end || "",
        startActual: t.start_actual || undefined,
        endActual: t.end_actual || undefined,
        ...(t.baseline_start ? { baselineStart: t.baseline_start } : {}),
        ...(t.baseline_finish ? { baselineFinish: t.baseline_finish } : {}),
        barType: t.bar_type === "delay" ? "delay" : "baseline",
      })).filter(t => t.activity || t.start || t.end);
    } else if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
      // Image - use AI Vision
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const extracted = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a Primavera P6 and Gantt chart expert. Analyze the provided image carefully.

FIRST, determine if this image is a "Duration Change Table" — a table listing Activity IDs, Activity Names, and a "New Duration" column (which may be labelled "New Duration", "Duration", "Revised Duration", etc., with values like "45 WD", "38 CD", "30", etc.).

IF it IS a Duration Change Table:
- Set is_duration_change_table=true
- Extract each row as: activity_id, activity_name, new_duration (number only), duration_unit ("WD" if working days are mentioned or implied, "CD" if calendar days, default "CD" if unclear)
- Leave start/end/is_section as null/false

IF it is NOT a Duration Change Table (it's a regular Gantt/schedule):
- Set is_duration_change_table=false
- Extract ALL schedule/programme data: SECTION HEADERS (is_section=true, activity=title, no start/end) and ACTIVITY ROWS (is_section=false, activity_id, start, end in YYYY-MM-DD format, bar_type="delay" or "baseline").
- ACTUAL DATE HANDLING: If dates are marked as Actual ("A" suffix, red text, or "Actual Start"/"Actual Finish" columns), put them in start/end AND set start_actual=true / end_actual=true. If both planned and actual exist, use actual as start/end and put planned in baseline_start/baseline_finish. Strip any "A" letter suffix from dates.
- WBS LEVELS (SECTION HEADERS only): set section_level to the nesting depth you can see (1 = top programme band, 2 = a sub-band, 3 = deeper ...), using in this order the leading WBS numbering in the title, the text indentation and the row background colour band. Also set section_color to the row's background colour as you actually see it. Omit either when unclear — never guess.`,
        file_urls: [uploadResult.file_url],
        response_json_schema: {
          type: "object",
          properties: {
            is_duration_change_table: { type: "boolean" },
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  is_section: { type: "boolean" },
                  section_type: { type: "string" },
                  activity: { type: "string" },
                  activity_id: { type: "string" },
                  item: { type: "string" },
                  start: { type: "string" },
                  end: { type: "string" },
                  start_actual: { type: "boolean" },
                  end_actual: { type: "boolean" },
                  baseline_start: { type: "string" },
                  baseline_finish: { type: "string" },
                  bar_type: { type: "string" },
                  section_level: { type: "number" },
                  section_color: { type: "string" },
                  new_duration: { type: "number" },
                  duration_unit: { type: "string" },
                }
              }
            }
          }
        },
        model: "gemini_3_1_pro",
      });
      if (extracted?.is_duration_change_table && extracted?.tasks?.length > 0) {
        // Duration Change format from image
        parsed = extracted.tasks.map(t => ({
          isSection: false,
          activity: t.activity || "",
          activityId: t.activity_id || "",
          newDuration: t.new_duration,
          durationUnit: t.duration_unit || "CD",
        })).filter(t => t.activityId && t.newDuration > 0);
      } else {
        parsed = (extracted?.tasks || []).map(t => ({
          isSection: !!t.is_section,
          sectionType: t.section_type || "blue",
          ...(t.section_level != null && !Number.isNaN(Number(t.section_level))
            ? { aiSectionLevel: Number(t.section_level) } : {}),
          ...(t.section_color ? { sectionColorName: String(t.section_color).trim() } : {}),
          activity: t.activity || "",
          activityId: t.activity_id || "",
          item: t.item || undefined,
          start: t.start || "",
          end: t.end || "",
          startActual: t.start_actual || undefined,
          endActual: t.end_actual || undefined,
          ...(t.baseline_start ? { baselineStart: t.baseline_start } : {}),
          ...(t.baseline_finish ? { baselineFinish: t.baseline_finish } : {}),
          barType: t.bar_type === "delay" ? "delay" : "baseline",
        })).filter(t => t.activity || t.start || t.end);
      }
    } else {
      throw new Error("Unsupported file format. Please upload Excel, XER, XML, PDF, or Image.");
    }
    if (!parsed || parsed.length === 0) {
      throw new Error("No tasks found in this file. Please check the file content.");
    }
    return parsed;
  }

  async function handleFileUpload(e, target) {
    const file = e.target.files?.[0] || e.dataTransfer?.files?.[0];
    if (!file) return;
    setParsing(true);
    setParseError("");
    setParseTarget(target);
    try {
      const parsed = await parseFile(file, target);
      const isVersionA = target === "A";
      const hasOtherVersion = isVersionA ? versionBTasks.length > 0 : (!!versionATasksFromFile || tasks.length > 0);
      
      // Debug logging for duration change format
      console.log("handleFileUpload - target:", target, "parsed length:", parsed.length, "first item:", parsed[0]);
      
      if (isVersionA) {
        setVersionATasksFromFile(parsed);
        setVersionAFile(file);
        // Immediately replace Gantt data with Version A (like normal import)
        if (onReplaceWithVersionA) {
          onReplaceWithVersionA(parsed);
        }
      } else {
        // Version B - check if this is a duration change format
        let versionBTasksToUse = parsed;
        const isDurationChange = parsed.length > 0 && parsed[0].newDuration !== undefined;
        
        console.log("Version B processing:", {
          isDurationChange,
          parsedLength: parsed.length,
          firstParsed: parsed[0],
          sourceTasks: versionATasksFromFile?.length || tasks.length
        });
        
        if (isDurationChange) {
          // This is a duration change file - apply duration changes to Version A tasks
          const durationChanges = {};
          parsed.forEach(change => {
            const key = (change.activityId || "").trim().toLowerCase();
            if (key && change.newDuration) {
              durationChanges[key] = {
                newDuration: parseInt(change.newDuration),
                durationUnit: change.durationUnit || "CD",
              };
            }
          });
          
          // Apply duration changes to Version A tasks
          const sourceTasks = versionATasksFromFile || tasks;
          versionBTasksToUse = sourceTasks
            .filter(t => !t.isSection)
            .map(task => {
              const key = (task.activityId || "").trim().toLowerCase();
              const change = durationChanges[key];
              if (change) {
                const { newDuration, durationUnit } = change;
                const startDate = task.start ? new Date(task.start) : null;
                const endDate = task.end ? new Date(task.end) : null;
                
                // Calculate original duration (calendar days, inclusive)
                let originalDuration = 0;
                if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                  originalDuration = Math.round((endDate - startDate) / 86400000) + 1;
                }
                
                let newEndDate = task.end;
                if (task.start && newDuration > 0) {
                  if (durationUnit === "WD") {
                    // Working days: use addWorkingDays (inclusive of start)
                    newEndDate = addWorkingDays(task.start, newDuration);
                  } else {
                    // Calendar days: start + (newDuration - 1) days
                    const calculatedEndDate = new Date(task.start + "T00:00:00");
                    calculatedEndDate.setDate(calculatedEndDate.getDate() + newDuration - 1);
                    newEndDate = calculatedEndDate.toISOString().slice(0, 10);
                  }
                }
                
                return { 
                  ...task, 
                  end: newEndDate,
                  _originalDuration: originalDuration,
                  _newDuration: newDuration,
                };
              }
              return task;
            });
        } else {
          // Regular format - just filter out sections
          versionBTasksToUse = parsed.filter(t => !t.isSection);
        }
        
        setVersionBTasks(versionBTasksToUse);
        setVersionBFile(file);
      }
      // Only go to step 2 if both versions are loaded
      if (hasOtherVersion) {
        setStep(2);
      }
    } catch (err) {
      setParseError("Failed to parse file: " + err.message);
    } finally {
      setParsing(false);
      setDragOverA(false);
      setDragOverB(false);
    }
  }

  function handleDragOver(e, target) {
    e.preventDefault();
    if (target === "A") setDragOverA(true);
    else setDragOverB(true);
  }

  function handleDragLeave(target) {
    if (target === "A") setDragOverA(false);
    else setDragOverB(false);
  }

  function handleDrop(e, target) {
    e.preventDefault();
    if (target === "A") setDragOverA(false);
    else setDragOverB(false);
    handleFileUpload(e, target);
  }

  async function handleAIAnalyse() {
    if (!textInput.trim()) return;
    setAiAnalysing(true);
    try {
      const GANTT_TASK_SCHEMA = {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                activity_id: { type: "string" },
                activity: { type: "string" },
                start: { type: "string" },
                end: { type: "string" },
                bar_type: { type: "string" },
                item: { type: "string" }
              }
            }
          }
        }
      };
      const currentTasksInfo = versionATasks.map(t => 
        `[${t.activityId || "N/A"}] ${t.activity} | Start: ${t.start || "N/A"} | End: ${t.end || "N/A"} | Item: ${t.item || "N/A"}`
      ).join("\n");
      const extracted = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a Primavera P6 and Gantt chart expert. The user has described changes to a project schedule. Based on their description, generate the complete Version B task list that reflects these changes.

CURRENT VERSION A TASKS:
${currentTasksInfo}

USER'S CHANGE DESCRIPTION:
"${textInput}"

INSTRUCTIONS:
1. Analyze the user's description of changes (delays, new tasks, date changes, etc.)
2. Generate ALL tasks for Version B - include unchanged tasks from Version A AND modified/new tasks
3. For unchanged tasks: keep activity_id, activity, start, end, item exactly the same
4. For delayed tasks: adjust start/end dates based on the description
5. For new tasks: create new entries with appropriate activity_id, activity, start, end
6. Use YYYY-MM-DD date format
7. bar_type = "delay" for delay events, otherwise "baseline"

Return the complete Version B task list as JSON.`,
        response_json_schema: GANTT_TASK_SCHEMA,
        model: "gemini_3_1_pro",
      });
      const parsed = (extracted?.tasks || []).map(t => ({
        isSection: false,
        sectionType: "blue",
        activity: t.activity || "",
        activityId: t.activity_id || "",
        item: t.item || undefined,
        start: t.start || "",
        end: t.end || "",
        barType: t.bar_type === "delay" ? "delay" : "baseline",
      })).filter(t => t.activity || t.start || t.end);
      if (parsed.length === 0) {
        setParseError("AI could not generate tasks from your description. Please try again or upload a file.");
      } else {
        setVersionBTasks(parsed);
        setStep(2);
      }
    } catch (err) {
      setParseError("AI analysis failed: " + err.message);
    } finally {
      setAiAnalysing(false);
    }
  }

  // Handle paste image from clipboard
  useEffect(() => {
    const handlePaste = async (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imgItem = items.find(item => item.type.startsWith("image/"));
      if (!imgItem || textInputMode) return; // Only handle image paste in file upload mode
      const blob = imgItem.getAsFile();
      if (!blob) return;
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const file = new File([blob], `pasted-image-${ts}.png`, { type: blob.type });
      // Route through handleFileUpload so duration-change logic applies
      handleFileUpload({ target: { files: [file] } }, "B");
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [textInputMode, versionATasksFromFile]);

  // Compute differences
  const diffResults = useMemo(() => {
    const matched = [];
    const newTasks = [];
    const unmatched = [];

    // Build lookup for duration change data from version B tasks
    const durationChangeLookup = {};
    versionBTasks.forEach(t => {
      if (t._originalDuration !== undefined && t._newDuration !== undefined) {
        durationChangeLookup[(t.activityId || "").trim().toLowerCase()] = {
          originalDuration: t._originalDuration,
          newDuration: t._newDuration,
        };
      }
    });

    console.log("diffResults - durationChangeLookup:", durationChangeLookup, "versionBTasks:", versionBTasks.length);

    versionBTasks.forEach((bTask, bIdx) => {
      const key = (bTask.activityId || "").trim().toLowerCase();
      const aTask = key ? versionALookup[key] : null;

      if (aTask) {
        // Matched - check for differences
        const diffs = [];
        
        // Check duration change if this was a duration change file
        const durChange = durationChangeLookup[key];
        if (durChange) {
          diffs.push({
            field: "Duration (days)",
            aVal: durChange.originalDuration,
            bVal: durChange.newDuration,
            type: durChange.newDuration > durChange.originalDuration ? "DELAYED" : "EARLIER",
          });
        }
        
        if (aTask.start !== bTask.start) {
          const aDate = new Date(aTask.start);
          const bDate = new Date(bTask.start);
          diffs.push({
            field: "Start Date",
            aVal: aTask.start,
            bVal: bTask.start,
            type: bDate > aDate ? "DELAYED" : "EARLIER",
          });
        }
        if (aTask.end !== bTask.end) {
          const aDate = new Date(aTask.end);
          const bDate = new Date(bTask.end);
          diffs.push({
            field: "End Date",
            aVal: aTask.end,
            bVal: bTask.end,
            type: bDate > aDate ? "DELAYED" : "EARLIER",
          });
        }
        if (aTask.activity !== bTask.activity) {
          diffs.push({ field: "Activity Name", aVal: aTask.activity, bVal: bTask.activity, type: "CHANGED" });
        }
        if (aTask.item && bTask.item && aTask.item !== bTask.item) {
          diffs.push({ field: "Item", aVal: aTask.item, bVal: bTask.item, type: "CHANGED" });
        }

        if (diffs.length > 0) {
          matched.push({
            versionA: aTask,
            versionB: bTask,
            versionBIndex: bIdx,
            diffs,
          });
        }
      } else {
        // Check if manually matched (by AI or manual selection)
        const manualMatchId = manualMatches[bIdx];
        const matchedATask = manualMatchId ? versionATasks.find(t => t.id === manualMatchId) : null;
        // Keep in newTasks with optional manual match info for review
        newTasks.push({ versionB: bTask, versionBIndex: bIdx, manualMatchATask: matchedATask || null });
      }
    });

    return { matched, newTasks, unmatched };
  }, [versionBTasks, versionALookup, manualMatches, versionATasks]);

  function handleManualMatch(versionBIndex, versionATaskId) {
    setManualMatches(prev => ({ ...prev, [versionBIndex]: versionATaskId }));
  }

  // AI-powered matching: analyse unmatched Version B activity names and
  // suggest the best matching Version A task, using WBS section context +
  // activity name similarity to determine the correspondence.
  async function handleAIMatch() {
    if (diffResults.newTasks.length === 0) return;
    setAiMatching(true);
    setAiMatchResult("");
    try {
      // ── Build WBS section context for Version A tasks ──
      // Walk the source array (with section markers) to map each task → its WBS section
      const sourceA = versionATasksFromFile || tasks;
      let currentSection = "";
      const taskSectionMap = {}; // taskId → WBS section name
      const wbsSections = [];    // ordered list of WBS section names
      sourceA.forEach(t => {
        if (t.isSection) {
          currentSection = t.activity || "";
          wbsSections.push(currentSection);
        } else {
          taskSectionMap[t.id] = currentSection;
        }
      });

      // Build Version A catalogue with WBS context
      const versionACatalogue = versionATasks.map(t => ({
        id: t.id,
        activityId: t.activityId || "",
        activity: t.activity || "",
        item: t.item || t._resolvedItem || t.customItem || "",
        wbs: taskSectionMap[t.id] || "",
      }));

      // Build unmatched Version B list (include activityId prefix as WBS hint)
      const unmatchedB = diffResults.newTasks.map(({ versionB, versionBIndex }) => ({
        index: versionBIndex,
        activityId: versionB.activityId || "",
        activity: versionB.activity || "",
      }));

      const extracted = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a construction scheduling expert. Match each Version B activity to the BEST corresponding Version A task.

Version A tasks are organized by WBS (Work Breakdown Structure) sections. You MUST use BOTH the WBS section context AND the activity name to find the best match.

WBS SECTIONS in Version A (in order):
${wbsSections.map((s, i) => `${i + 1}. ${s}`).join("\n")}

VERSION A TASKS (with WBS section):
${JSON.stringify(versionACatalogue, null, 2)}

VERSION B UNMATCHED ACTIVITIES (need matching):
${JSON.stringify(unmatchedB, null, 2)}

MATCHING INSTRUCTIONS:
- For each Version B activity, find the single best-matching Version A task by analysing:
  1. Activity name similarity — semantic match, partial match, abbreviation expansion (e.g. "Excavation" ↔ "Excavation Works", "Noise Barrier" ↔ "Noise Barrier Footing")
  2. WBS section context — if the Version B activity's ID prefix or description hints at a WBS section, prefer Version A tasks in the same/similar section
  3. Activity ID patterns — prefixes (e.g. "INTS2-", "CLP-", "WSD-") may indicate the same work package
- Only return matches with "high" or "medium" confidence. Skip uncertain ones (confidence "low").
- Return versionB_index (the "index" field) and versionA_id (the "id" field from Version A).
- If no good match exists for an activity, do NOT include it in the results.

Return the match list as JSON.`,
        response_json_schema: {
          type: "object",
          properties: {
            matches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  versionB_index: { type: "number" },
                  versionA_id: { type: "number" },
                  confidence: { type: "string" },
                },
              },
            },
          },
        },
        model: "gemini_3_1_pro",
      });

      const matches = (extracted?.matches || []).filter(
        m => m.confidence === "high" || m.confidence === "medium"
      );
      const newManualMatches = {};
      matches.forEach(m => {
        newManualMatches[m.versionB_index] = m.versionA_id;
      });
      setManualMatches(prev => ({ ...prev, ...newManualMatches }));
      setAiMatchResult(`AI matched ${matches.length} of ${unmatchedB.length} unmatched activities.`);
    } catch (err) {
      setAiMatchResult("AI matching failed: " + err.message);
    } finally {
      setAiMatching(false);
    }
  }

  // ── Auto-trigger AI matching when Version B is loaded and there are unmatched tasks ──
  // Uses a signature (filename + task count) to ensure it only fires once per upload.
  useEffect(() => {
    if (step !== 2) return;
    if (diffResults.newTasks.length === 0) return;
    const sig = `${versionBFile?.name || "text"}|${versionBTasks.length}`;
    if (autoMatchTriggeredRef.current === sig) return;
    autoMatchTriggeredRef.current = sig;
    handleAIMatch();
     
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, versionBTasks, versionBFile, diffResults.newTasks.length]);

  function handleApply() {
    if (!saveToHistory || !onApplyChanges) return;
    if (!window.confirm("Apply Version B changes to Gantt? This will overwrite matching tasks and add new tasks.")) return;

    saveToHistory(tasks);

    const updates = {};
    const newTasks = [];

    // Apply matched changes - need to find by activityId if Version A is from file
    diffResults.matched.forEach(({ versionA, versionB }) => {
      // Find the actual task in the Gantt (tasks prop) by activityId
      const ganttTask = tasks.find(t => !t.isSection && (t.activityId || "").trim().toLowerCase() === (versionA.activityId || "").trim().toLowerCase());
      if (ganttTask) {
        const startChanged = versionB.start && versionB.start !== ganttTask.start;
        const endChanged = versionB.end && versionB.end !== ganttTask.end;
        updates[ganttTask.id] = {
          ...ganttTask,
          // Version B dates → latest Actual dates
          start: versionB.start,
          end: versionB.end,
          startActual: versionB.start ? true : (versionB.startActual ?? ganttTask.startActual),
          endActual: versionB.end ? true : (versionB.endActual ?? ganttTask.endActual),
          activity: versionB.activity,
          item: versionB.item || ganttTask.item,
          barType: versionB.barType || ganttTask.barType,
          // Version A dates → Baseline dates
          baselineStart: versionA.start || ganttTask.baselineStart || "",
          baselineFinish: versionA.end || ganttTask.baselineFinish || "",
        };
      }
    });

    // Add new tasks — Version B dates are Actual dates
    // Tasks with a manual/AI match → update existing Gantt task; truly new → create
    diffResults.newTasks.forEach(({ versionB, manualMatchATask }) => {
      if (manualMatchATask) {
        const ganttTask = tasks.find(t => !t.isSection && t.id === manualMatchATask.id);
        if (ganttTask) {
          updates[ganttTask.id] = {
            ...ganttTask,
            start: versionB.start || ganttTask.start,
            end: versionB.end || ganttTask.end,
            startActual: versionB.start ? true : (versionB.startActual ?? ganttTask.startActual),
            endActual: versionB.end ? true : (versionB.endActual ?? ganttTask.endActual),
            activity: versionB.activity || ganttTask.activity,
            item: versionB.item || ganttTask.item,
            barType: versionB.barType || ganttTask.barType,
            baselineStart: manualMatchATask.start || ganttTask.baselineStart || "",
            baselineFinish: manualMatchATask.end || ganttTask.baselineFinish || "",
          };
          return;
        }
      }
      newTasks.push({
        id: Date.now() + Math.random(),
        activityId: versionB.activityId || "",
        activity: versionB.activity || "",
        start: versionB.start || "",
        end: versionB.end || "",
        startActual: versionB.start ? true : undefined,
        endActual: versionB.end ? true : undefined,
        barType: versionB.barType || "baseline",
        item: versionB.item || "",
      });
    });

    onApplyChanges({ updates, newTasks });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl flex flex-col" style={{ width: 900, maxWidth: "98vw", maxHeight: "94vh" }}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <GitCompare size={18} className="text-surface" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text">Compare & Update</h2>
              <p className="text-xs text-text-muted">Compare current Gantt with new version and apply changes</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-muted transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === 1 ? (
            <div className="p-6 space-y-6">
              {/* Version A upload/info */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-surface-subtle flex items-center justify-center">
                    <FileText size={16} className="text-primary" />
                  </div>
                  <div className="text-sm font-semibold text-text">Version A {versionAFile ? "(Uploaded File)" : "(Current Gantt)"}</div>
                </div>
                {versionAFile ? (
                  <div className="p-4 bg-surface-subtle border border-border rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-subtle flex items-center justify-center">
                          <CheckCircle size={16} className="text-primary" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-primary">{versionAFile.name}</div>
                          <div className="text-xs text-primary">
                            <strong>{versionATasks.length}</strong> tasks · <strong>{versionASections.length}</strong> sections
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => { setVersionATasksFromFile(null); setVersionAFile(null); }}
                        className="text-xs text-primary hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => handleDragOver(e, "A")}
                    onDragLeave={() => handleDragLeave("A")}
                    onDrop={(e) => handleDrop(e, "A")}
                    className={`p-4 border-2 rounded-xl transition-all ${
                      dragOverA ? "border-primary bg-surface-subtle" : "border-border bg-surface-subtle"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-surface-muted flex items-center justify-center">
                        <FileText size={16} className="text-text-muted" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-text">Using current Gantt data</div>
                        <div className="text-xs text-text-muted">
                          <strong>{versionATasks.length}</strong> tasks · <strong>{versionASections.length}</strong> sections
                        </div>
                      </div>
                    </div>
                    <input ref={fileARef} type="file" accept=".xlsx,.xls,.xer,.xml,.pdf,image/*" className="hidden" onChange={(e) => handleFileUpload(e, "A")} />
                    <button
                      onClick={() => fileARef.current?.click()}
                      disabled={parsing && parseTarget === "A"}
                      className="w-full mt-2 border-2 border-dashed border-border rounded-lg p-3 text-xs font-medium text-text-muted hover:border-primary hover:bg-surface-subtle transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {parsing && parseTarget === "A" ? "Parsing..." : "Or click / drag & drop to upload file for Version A"}
                    </button>
                  </div>
                )}
              </div>

              {/* Version B upload */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-surface-subtle flex items-center justify-center">
                    <Upload size={16} className="text-success" />
                  </div>
                  <div className="text-sm font-semibold text-text">Version B (Upload File or Describe Changes)</div>
                </div>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setTextInputMode(false)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                      !textInputMode ? "bg-success text-surface border-success" : "bg-surface text-text-muted border-border hover:border-success"
                    }`}
                  >
                    Upload File
                  </button>
                  <button
                    onClick={() => setTextInputMode(true)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                      textInputMode ? "bg-primary text-surface border-primary" : "bg-surface text-text-muted border-border hover:border-primary"
                    }`}
                  >
                    Describe Changes (AI)
                  </button>
                </div>
                {!textInputMode ? (
                  <div>
                    <input ref={fileBRef} type="file" accept=".xlsx,.xls,.xer,.xml,.pdf,image/*" className="hidden" onChange={(e) => handleFileUpload(e, "B")} />
                    {versionBFile ? (
                      <div className="p-4 bg-surface-subtle border-2 border-success rounded-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-success flex items-center justify-center flex-shrink-0">
                              <CheckCircle size={18} className="text-surface" />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-success">{versionBFile.name}</div>
                              <div className="text-xs text-success mt-0.5">
                                <strong>{versionBTasks.length}</strong> tasks loaded as Version B
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => { setVersionBTasks([]); setVersionBFile(null); }}
                            className="text-xs text-success hover:underline flex-shrink-0"
                          >
                            Replace
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => handleDragOver(e, "B")}
                        onDragLeave={() => handleDragLeave("B")}
                        onDrop={(e) => handleDrop(e, "B")}
                        className={`border-2 rounded-xl transition-all ${
                          dragOverB ? "border-success bg-surface-subtle" : "border-border"
                        }`}
                      >
                        <button
                          onClick={() => fileBRef.current?.click()}
                          disabled={parsing && parseTarget === "B"}
                          className="w-full border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 hover:border-success hover:bg-surface-subtle transition-all cursor-pointer text-left disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {parsing && parseTarget === "B" ? (
                            <>
                              <div className="w-12 h-12 rounded-full bg-surface-muted flex items-center justify-center">
                                <div className="w-5 h-5 border-2 border-border border-t-success rounded-full animate-spin"></div>
                              </div>
                              <div className="text-sm font-medium text-text-muted">Parsing file...</div>
                            </>
                          ) : (
                            <>
                              <div className="w-12 h-12 rounded-full bg-surface-subtle flex items-center justify-center">
                                <Upload size={22} className="text-success" />
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-semibold text-text">Upload File or Paste (Ctrl+V)</div>
                                <div className="text-xs text-text-muted mt-0.5">Excel · XER · XML · PDF · Image</div>
                              </div>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    {parseError && parseTarget === "B" && <p className="text-xs text-danger mt-2 flex items-center gap-1"><AlertCircle size={12} />{parseError}</p>}
                  </div>
                ) : (
                  <div className="border-2 border-border rounded-xl p-4 bg-surface-subtle">
                    <label className="block text-xs font-semibold text-primary mb-2">Describe Changes</label>
                    <textarea
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="e.g. 'Delay all activities by 14 days starting from activity A5', or 'Add 3 new activities for testing phase after B9', or 'Change activity B3 start date to 2025-03-01'"
                      className="w-full border border-primary rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:ring-2 focus:ring-focus bg-surface"
                      rows={4}
                    />
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-primary">AI will generate Version B based on your description</span>
                      <button
                        onClick={handleAIAnalyse}
                        disabled={!textInput.trim() || aiAnalysing}
                        className="px-4 py-2 bg-primary hover:bg-primary-active disabled:bg-primary text-surface text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        {aiAnalysing ? (
                          <>
                            <div className="w-3 h-3 border-2 border-surface border-t-transparent rounded-full animate-spin"></div>
                            Analysing...
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                            Generate with AI
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5" style={{ animation: "fadeIn 0.2s ease-out" }}>
              {/* Summary bar */}
              <div className="grid grid-cols-4 gap-3">
                <div className="flex flex-col items-center py-3 px-2 bg-surface-subtle border border-border rounded-xl">
                  <span className="text-lg font-bold text-text">{versionATasks.length}</span>
                  <span className="text-xs text-text-muted mt-0.5">Ver A Tasks</span>
                </div>
                <div className="flex flex-col items-center py-3 px-2 bg-surface-subtle border border-border rounded-xl">
                  <span className="text-lg font-bold text-text">{versionBTasks.length}</span>
                  <span className="text-xs text-text-muted mt-0.5">Ver B Tasks</span>
                </div>
                <div className="flex flex-col items-center py-3 px-2 bg-table-header border border-border rounded-xl">
                  <span className="text-lg font-bold text-accent-selected">{diffResults.matched.length}</span>
                  <span className="text-xs text-accent-selected mt-0.5">With Changes</span>
                </div>
                <div className="flex flex-col items-center py-3 px-2 bg-surface-subtle border border-border rounded-xl">
                  <span className="text-lg font-bold text-success">{diffResults.newTasks.length}</span>
                  <span className="text-xs text-success mt-0.5">New Tasks</span>
                </div>
              </div>

              {/* Change files link */}
              <div className="flex justify-end">
                <button
                  onClick={() => { setStep(1); setVersionBTasks([]); setVersionBFile(null); setManualMatches({}); }}
                  className="text-xs text-primary hover:text-primary hover:underline transition-colors"
                >
                  ← Change files
                </button>
              </div>

              {/* Tasks with Differences */}
              {diffResults.matched.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-table-header text-accent-selected text-xs flex items-center justify-center font-bold">{diffResults.matched.length}</span>
                    Tasks with Differences
                  </h3>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-xs table-fixed">
                      <colgroup>
                        <col style={{ width: "20%" }} />
                        <col style={{ width: "13%" }} />
                        <col style={{ width: "21%" }} />
                        <col style={{ width: "21%" }} />
                        <col style={{ width: "13%" }} />
                        <col style={{ width: "12%" }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-surface-muted border-b border-border text-text-muted font-semibold">
                          <th className="text-left px-3 py-2.5">Activity</th>
                          <th className="text-left px-3 py-2.5">Field</th>
                          <th className="text-left px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
                              Version A
                            </span>
                          </th>
                          <th className="text-left px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-success inline-block"></span>
                              Version B
                            </span>
                          </th>
                          <th className="text-left px-3 py-2.5">Status</th>
                          <th className="text-left px-3 py-2.5">WD Dur.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diffResults.matched.flatMap(({ versionA, versionB, diffs }, idx) => {
                          const hasDateDiff = diffs.some(d => d.field === "Start Date" || d.field === "End Date" || d.field === "Duration (days)");
                          const aStart = versionA.start; const aEnd = versionA.end;
                          const bStart = versionB.start; const bEnd = versionB.end;
                          const aWd = (aStart && aEnd) ? countWorkingDays(aStart, aEnd) : null;
                          const bWd = (bStart && bEnd) ? countWorkingDays(bStart, bEnd) : null;
                          const wdDiff = (aWd !== null && bWd !== null) ? bWd - aWd : null;
                          const wdCell = (hasDateDiff && wdDiff !== null) ? (
                            <div className="text-xs">
                              <span className="text-text-muted font-mono">{aWd}→{bWd}wd</span>
                              <span className={`ml-1 font-bold ${wdDiff > 0 ? "text-success" : wdDiff < 0 ? "text-accent-selected" : "text-text-muted"}`}>
                                ({wdDiff > 0 ? "+" : ""}{wdDiff})
                              </span>
                            </div>
                          ) : <span className="text-text-muted">—</span>;

                          return diffs.map((d, i) => (
                            <tr
                              key={`${idx}-${i}`}
                              className={`border-b border-border last:border-0 transition-colors ${idx % 2 === 0 ? "bg-surface" : "bg-surface-subtle/60"}`}
                            >
                              {i === 0 && (
                                <td rowSpan={diffs.length} className="px-3 py-2.5 align-middle border-r border-border">
                                  <div className="font-mono text-primary font-bold text-xs">{versionA.activityId || versionB.activityId}</div>
                                  <div className="text-text-muted text-xs mt-0.5 leading-tight line-clamp-2">{versionA.activity}</div>
                                </td>
                              )}
                              <td className="px-3 py-2.5 text-text-muted font-medium whitespace-nowrap">{d.field}</td>
                              <td className="px-3 py-2.5 text-text font-mono">{d.aVal ?? "—"}</td>
                              <td className="px-3 py-2.5 text-text font-mono">{d.bVal ?? "—"}</td>
                              <td className="px-3 py-2.5"><DiffBadge type={d.type} /></td>
                              {i === 0 && (
                                <td rowSpan={diffs.length} className="px-3 py-2.5 align-middle border-l border-border">
                                  {wdCell}
                                </td>
                              )}
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* New Tasks / AI Match Review */}
              {diffResults.newTasks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-surface-subtle text-success text-xs flex items-center justify-center font-bold">{diffResults.newTasks.length}</span>
                      New / Unmatched Tasks
                    </h3>
                    <div className="flex items-center gap-3">
                      {aiMatchResult && (
                        <span className="text-xs text-text-muted">{aiMatchResult}</span>
                      )}
                      <button
                        onClick={() => {
                          setManualMatches({});
                          autoMatchTriggeredRef.current = "";
                          handleAIMatch();
                        }}
                        disabled={aiMatching}
                        className="px-3 py-1.5 bg-primary hover:bg-primary-active disabled:bg-primary text-surface text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        {aiMatching ? (
                          <>
                            <div className="w-3 h-3 border-2 border-surface border-t-transparent rounded-full animate-spin"></div>
                            AI Matching...
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                            Re-search AI Match
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="border border-border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-xs table-fixed">
                      <colgroup>
                        <col style={{ width: "14%" }} />
                        <col style={{ width: "28%" }} />
                        <col style={{ width: "40%" }} />
                        <col style={{ width: "18%" }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-surface-muted border-b border-border text-text-muted font-semibold sticky top-0">
                          <th className="text-left px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-success inline-block"></span>
                              Ver B ID
                            </span>
                          </th>
                          <th className="text-left px-3 py-2.5">Version B Activity</th>
                          <th className="text-left px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
                              Matched Version A Task (WBS · Name · ID)
                            </span>
                          </th>
                          <th className="text-left px-3 py-2.5">Ver B Dates</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diffResults.newTasks.map(({ versionB, versionBIndex, manualMatchATask }, idx) => (
                          <tr key={idx} className={`${idx % 2 === 0 ? "bg-surface" : "bg-surface-subtle/60"} border-b border-border last:border-0 ${manualMatchATask ? "bg-surface-subtle/40" : ""}`}>
                            <td className="px-3 py-2 font-mono text-success font-semibold align-top">{versionB.activityId || "—"}</td>
                            <td className="px-3 py-2 text-text align-top">
                              <div className="leading-tight">{versionB.activity || "—"}</div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              {manualMatchATask ? (
                                <div className="space-y-1">
                                  <div className="flex items-start gap-1.5">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-subtle text-primary text-xs font-semibold flex-shrink-0">
                                      <CheckCircle size={10} /> AI Match
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs text-text-muted font-medium truncate">{versionAWbsMap[manualMatchATask.id] || "(no WBS)"}</div>
                                      <div className="text-xs text-text font-medium leading-tight">{manualMatchATask.activity}</div>
                                      <div className="text-xs font-mono text-primary font-semibold">{manualMatchATask.activityId || "—"}</div>
                                    </div>
                                  </div>
                                  <select
                                    value={manualMatches[versionBIndex] || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setManualMatches(prev => {
                                        const next = { ...prev };
                                        if (val === "") delete next[versionBIndex];
                                        else next[versionBIndex] = Number(val);
                                        return next;
                                      });
                                    }}
                                    className="w-full border border-border rounded px-1.5 py-1 text-xs text-text-muted focus:outline-none focus:ring-1 focus:ring-focus bg-surface"
                                  >
                                    <option value="">— Clear match (add as new) —</option>
                                    {versionATasks.map(t => (
                                      <option key={t.id} value={t.id}>
                                        {(versionAWbsMap[t.id] || "") ? `[${versionAWbsMap[t.id]}] ` : ""}{t.activityId || "—"} · {t.activity}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div>
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-muted text-text-muted text-xs font-medium mb-1">
                                    Unmatched
                                  </span>
                                  <select
                                    value={manualMatches[versionBIndex] || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setManualMatches(prev => {
                                        const next = { ...prev };
                                        if (val === "") delete next[versionBIndex];
                                        else next[versionBIndex] = Number(val);
                                        return next;
                                      });
                                    }}
                                    className="w-full border border-border rounded px-1.5 py-1 text-xs text-text-muted focus:outline-none focus:ring-1 focus:ring-focus bg-surface"
                                  >
                                    <option value="">— Select a Version A task to match —</option>
                                    {versionATasks.map(t => (
                                      <option key={t.id} value={t.id}>
                                        {(versionAWbsMap[t.id] || "") ? `[${versionAWbsMap[t.id]}] ` : ""}{t.activityId || "—"} · {t.activity}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="font-mono text-xs" style={{ color: versionB.startActual ? "#dc3545" : "#003531", fontWeight: versionB.startActual ? 600 : 400 }}>
                                {versionB.start || "—"}{versionB.startActual ? " A" : ""}
                              </div>
                              <div className="font-mono text-xs" style={{ color: versionB.endActual ? "#dc3545" : "#003531", fontWeight: versionB.endActual ? 600 : 400 }}>
                                {versionB.end || "—"}{versionB.endActual ? " A" : ""}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* No differences */}
              {diffResults.matched.length === 0 && diffResults.newTasks.length === 0 && (
                <div className="py-12 text-center text-text-muted">
                  <CheckCircle size={36} className="mx-auto mb-3 text-success" />
                  <p className="text-sm font-semibold text-text">No differences found</p>
                  <p className="text-xs text-text-muted mt-1">Version B is identical to Version A</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          {step === 2 && (
            <Button
              size="sm"
              onClick={handleApply}
              disabled={diffResults.matched.length === 0 && diffResults.newTasks.length === 0}
              className="bg-success hover:bg-primary-dark text-surface"
            >
              <CheckCircle size={14} className="mr-1.5" />
              Apply Version B to Gantt
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
