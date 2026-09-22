import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Batch 49 — one shared programme for the whole app.
 *
 * The Gantt page and the P6 Data Explorer must always show the same file, the
 * same raw tables and the same selected project: loading (or choosing) a
 * programme in either page publishes it here, and both pages read from here.
 *
 * Parsed tables live in memory only (a real XER is far too big for a storage
 * quota); the light metadata — and the file text when it is small enough to fit —
 * is remembered in localStorage so a reload can rebuild the tables on demand.
 */
export const PROGRAMME_STORAGE_KEY = "p6_shared_programme";
export const MAX_PERSISTED_TEXT = 2 * 1024 * 1024;
/**
 * Batch 60 — how much room the parsed programme may take in localStorage. The tasks
 * ARE the programme: persisting them means a reload — or the auth spinner unmounting
 * the routes — restores the same programme instead of the built-in default one.
 */
export const MAX_PERSISTED_TASKS = 1536 * 1024;

/** The neutral value used before anything has been loaded. */
export function emptyProgramme() {
  return {
    fileName: "",
    format: null,
    tables: null,
    text: "",
    tasks: null,          // batch 54 — the parsed programme, so pages can swap freely
    versionId: null,      // batch 54 — which stored version is open
    versionName: "",
    projectId: null,
    projectName: "",
    source: null,
    revision: 0,
  };
}

function safeStorage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Read the persisted slice (metadata + small text); tables are never persisted. */
export function readPersistedProgramme(storage) {
  if (!storage) return emptyProgramme();
  try {
    const raw = storage.getItem(PROGRAMME_STORAGE_KEY);
    if (!raw) return emptyProgramme();
    const parsed = JSON.parse(raw);
    return { ...emptyProgramme(), ...parsed, tables: null };
  } catch {
    return emptyProgramme();
  }
}

/**
 * Persist the programme: metadata always, the parsed tasks and the file text when
 * they fit. Returns whether the TEXT fit (batch 60 — a text too big to store no
 * longer throws the rest away, which used to make a reload lose the project too).
 */
export function writePersistedProgramme(storage, programme) {
  if (!storage || !programme) return false;
  const text = String(programme.text || "");
  const textFits = text.length <= MAX_PERSISTED_TEXT;
  let tasks = null;
  if (Array.isArray(programme.tasks)) {
    try {
      tasks = JSON.stringify(programme.tasks).length <= MAX_PERSISTED_TASKS ? programme.tasks : null;
    } catch {
      tasks = null;
    }
  }
  try {
    storage.setItem(PROGRAMME_STORAGE_KEY, JSON.stringify({
      fileName: programme.fileName || "",
      format: programme.format || null,
      text: textFits ? text : "",
      tasks,
      versionId: programme.versionId ?? null,
      versionName: programme.versionName || "",
      projectId: programme.projectId ?? null,
      projectName: programme.projectName || "",
      source: programme.source || null,
      revision: programme.revision || 0,
    }));
    return textFits;
  } catch {
    return false;
  }
}

const ProgrammeContext = createContext(null);

/** Wrap the routes: both pages then share one programme. */
export function ProgrammeProvider({ children, initial = null }) {
  const [programme, setProgramme] = useState(
    () => initial || readPersistedProgramme(safeStorage())
  );

  /** Merge a patch in and remember it. `source` says which page published it. */
  const publishProgramme = useCallback((patch, source = "gantt") => {
    setProgramme((prev) => {
      const next = { ...prev, ...patch, source, revision: (prev.revision || 0) + 1 };
      writePersistedProgramme(safeStorage(), next);
      return next;
    });
  }, []);

  const clearProgramme = useCallback(() => {
    try {
      const storage = safeStorage();
      if (storage) storage.removeItem(PROGRAMME_STORAGE_KEY);
    } catch {
      /* ignore quota / privacy-mode errors */
    }
    setProgramme(emptyProgramme());
  }, []);

  const value = useMemo(
    () => ({ programme, publishProgramme, clearProgramme }),
    [programme, publishProgramme, clearProgramme]
  );

  return <ProgrammeContext.Provider value={value}>{children}</ProgrammeContext.Provider>;
}

/** The shared programme (and its writers). Safe to call outside the provider. */
export function useProgramme() {
  const ctx = useContext(ProgrammeContext);
  return ctx || { programme: emptyProgramme(), publishProgramme: () => {}, clearProgramme: () => {} };
}
