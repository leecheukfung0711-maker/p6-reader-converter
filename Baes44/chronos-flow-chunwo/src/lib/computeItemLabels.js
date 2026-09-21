// Convert 0-based index to Excel-style column label: 0→A, 25→Z, 26→AA, 27→AB...
function toColumnLabel(n) {
  let label = "";
  n = n + 1; // 1-based
  while (n > 0) {
    n--;
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26);
  }
  return label;
}

// Compute effective item labels for all tasks.
// Each section gets a letter (A, B, C...). Tasks under it are numbered A1, A2...
// Within each section, tasks are grouped by barType (BL/DE) with independent counters.
// If a task has a manual customItem, it breaks the sequence from that point.
export function computeItemLabels(tasks) {
  let sectionIdx = -1;
  let sectionPrefix = "";
  const typeCounters = {}; // Track counters per barType within each section

  return tasks.map((task) => {
    if (task.isSection) {
      sectionIdx++;
      // A-Z, then AA, AB, AC... like Excel columns
      sectionPrefix = toColumnLabel(sectionIdx);
      Object.keys(typeCounters).forEach(key => delete typeCounters[key]); // Reset counters
      return { ...task };
    }

    if (task.customItem !== undefined && task.customItem !== null) {
      // Manual override: parse any trailing number to continue sequence
      const match = task.customItem.match(/^(.*?)(\d+)$/);
      if (match) {
        const prefix = match[1];
        const num = parseInt(match[2], 10);
        typeCounters[prefix] = num;
      }
      return { ...task, _resolvedItem: task.customItem };
    }

    // Get the type prefix
    const barType = task.barType || "baseline";
    const isDelay = barType === "delay";
    
    // BL: use section prefix (A1, A2...), DE: use DE prefix (DE1, DE2...)
    const fullPrefix = isDelay ? "DE" : sectionPrefix;

    // Increment counter for this type
    if (!typeCounters[fullPrefix]) {
      typeCounters[fullPrefix] = 0;
    }
    typeCounters[fullPrefix]++;

    return { ...task, _resolvedItem: `${fullPrefix}${typeCounters[fullPrefix]}` };
  });
}