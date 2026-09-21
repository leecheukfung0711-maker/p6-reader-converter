/**
 * Build a bidirectional relationship map from tasks.
 *
 * Relationships come from two sources:
 * 1. `links` array (from XER/XML import) — each entry: { succId, type, lag }
 * 2. Legacy single `link` field (from manual chain binding) — stores successor task ID
 *
 * All IDs are normalized to numbers for consistent Map/Set lookups.
 *
 * Returns: Map<taskId, { predecessors: Set<taskId>, successors: Set<taskId> }>
 */
export function buildRelationshipMap(tasks) {
  const map = new Map();

  const ensure = (id) => {
    const numId = Number(id);
    if (isNaN(numId)) return null;
    if (!map.has(numId)) map.set(numId, { predecessors: new Set(), successors: new Set() });
    return map.get(numId);
  };

  // Initialize entries for all non-section tasks
  tasks.forEach(t => {
    if (t.isSection) return;
    ensure(t.id);
  });

  // Build edges from both sources
  tasks.forEach(t => {
    if (t.isSection) return;
    const predEntry = ensure(t.id);
    if (!predEntry) return;

    // From links array (multiple relationships)
    if (t.links && Array.isArray(t.links)) {
      t.links.forEach(l => {
        if (!l.succId) return;
        const succEntry = ensure(l.succId);
        if (!succEntry) return;
        predEntry.successors.add(Number(l.succId));
        succEntry.predecessors.add(Number(t.id));
      });
    }

    // From legacy single link (if not already covered by links array)
    if (t.link) {
      const succId = Number(t.link);
      const alreadyInLinks = t.links && t.links.some(l => Number(l.succId) === succId);
      if (!alreadyInLinks) {
        const succEntry = ensure(t.link);
        if (succEntry) {
          predEntry.successors.add(succId);
          succEntry.predecessors.add(Number(t.id));
        }
      }
    }
  });

  return map;
}

/**
 * Resolve `linkSuccCode` and `links[].succCode` (successor activityId from
 * XER/XML import) to actual Gantt task IDs after tasks have been assigned IDs.
 *
 * Tasks imported from XER/XML carry:
 * - `links` array: [{ succCode, type, lag }] — successor's P6 activity code
 * - `linkSuccCode`: legacy single successor's P6 activity code
 *
 * This function maps activityId → task.id and fills in `link` (legacy) and
 * resolves `links[].succCode` → `links[].succId`.
 */
export function resolveImportedLinks(taskArr) {
  const codeToId = {};
  taskArr.forEach(t => {
    if (!t.isSection && t.activityId) {
      codeToId[t.activityId.trim().toLowerCase()] = t.id;
    }
  });

  return taskArr.map(t => {
    if (t.isSection) return t;

    // Resolve links array: succCode → succId
    let resolvedLinks = [];
    if (t.links && Array.isArray(t.links)) {
      resolvedLinks = t.links
        .map(l => {
          if (l.succId) return l; // already resolved
          if (!l.succCode) return null;
          const succId = codeToId[l.succCode.trim().toLowerCase()];
          return succId ? { succId, type: l.type || "FS", lag: l.lag || 0 } : null;
        })
        .filter(Boolean);
    }

    // Resolve legacy single linkSuccCode → link
    let link = t.link;
    if (!link && t.linkSuccCode) {
      link = codeToId[t.linkSuccCode.trim().toLowerCase()];
    }

    return { ...t, link, links: resolvedLinks.length > 0 ? resolvedLinks : undefined };
  });
}

/**
 * Like `buildRelationshipMap`, but keeps the relationship **details** the
 * activity information panel needs: type (FS/SS/FF/SF) and lag for every edge.
 *
 * Same two sources as `buildRelationshipMap`:
 *   1. `links` array (XER/XML import) — [{ succId, type, lag }]
 *   2. legacy single `link` (manual chain binding / first imported relationship)
 *
 * Returns Map<taskId, { predecessors: [{ id, type, lag }], successors: [...] }>
 * where `id` is the *other* task's numeric id.
 */
export function buildRelationshipDetails(tasks) {
  const map = new Map();

  const ensure = (id) => {
    const numId = Number(id);
    if (Number.isNaN(numId)) return null;
    if (!map.has(numId)) map.set(numId, { predecessors: [], successors: [] });
    return map.get(numId);
  };

  tasks.forEach(t => { if (!t.isSection) ensure(t.id); });

  tasks.forEach(t => {
    if (t.isSection) return;
    const predEntry = ensure(t.id);
    if (!predEntry) return;

    // Collect this task's outgoing edges (it is the predecessor)
    const edges = [];
    if (Array.isArray(t.links)) {
      t.links.forEach(l => {
        if (!l || l.succId == null) return;
        const succId = Number(l.succId);
        if (Number.isNaN(succId)) return;
        edges.push({ succId, type: l.type || "FS", lag: Number(l.lag) || 0 });
      });
    }
    if (t.link != null && t.link !== "") {
      const succId = Number(t.link);
      if (!Number.isNaN(succId) && !edges.some(e => e.succId === succId)) {
        edges.push({
          succId,
          type: t.relType || t.linkType || "FS",
          lag: Number(t.linkOffset) || 0,
        });
      }
    }

    edges.forEach(e => {
      const succEntry = ensure(e.succId);
      if (!succEntry) return;
      const selfId = Number(t.id);
      if (!predEntry.successors.some(s => s.id === e.succId)) {
        predEntry.successors.push({ id: e.succId, type: e.type, lag: e.lag });
      }
      if (!succEntry.predecessors.some(p => p.id === selfId)) {
        succEntry.predecessors.push({ id: selfId, type: e.type, lag: e.lag });
      }
    });
  });

  return map;
}