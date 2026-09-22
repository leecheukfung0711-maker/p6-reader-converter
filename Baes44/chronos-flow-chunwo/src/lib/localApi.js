/**
 * Local backend API client — project + programme-version storage.
 *
 * The app itself keeps talking to the Base44 cloud through `@/api/base44Client`
 * (LLM, functions, …). This client only serves the ProjectBar
 * (choose project / upload / save), which stores projects and versions in the LOCAL
 * FastAPI backend (backend/db/pyworkflow.db).
 *
 * Requests go to /local-api/... which the Vite dev server proxies to
 * http://localhost:<BACKEND_PORT> (see vite.config.js — the port is read from
 * the workspace root .env, never hardcoded). If that backend is not running the
 * proxy fails and we surface a readable hint instead of a raw 500/502.
 */
const API_BASE = "/local-api";

export const BACKEND_HINT =
  "The local backend is not running — start it from the workspace root (P6 Reader & Converter) with " +
  "scripts\\start-backend.bat, or run scripts\\start-all.bat with START_BACKEND=1 set " +
  "(this backend only serves project storage / saving).";

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers:
        options.body instanceof FormData
          ? undefined
          : { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
  } catch (err) {
    // Network-level failure (proxy down / backend not listening).
    const e = new Error(`${BACKEND_HINT} [${err.message}]`);
    e.backendDown = true;
    throw e;
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch {
      /* non-JSON error body */
    }
    const err = new Error(res.status >= 500 ? `${detail} — ${BACKEND_HINT}` : detail);
    err.status = res.status;
    err.backendDown = res.status >= 500;
    throw err;
  }
  return res.json();
}

export const localApi = {
  listProjects: () => request("/projects"),

  createProject: (name, description = "") => {
    const body = new FormData();
    body.append("name", name);
    body.append("description", description);
    return request("/projects", { method: "POST", body });
  },

  getProject: (id) => request(`/projects/${id}`),
  deleteProject: (id) => request(`/projects/${id}`, { method: "DELETE" }),

  listVersions: (projectId) => request(`/projects/${projectId}/versions`),

  createVersion: (projectId, payload, name, isSnapshot = false) =>
    request(`/projects/${projectId}/versions`, {
      method: "POST",
      body: JSON.stringify({ payload, name, is_snapshot: isSnapshot }),
    }),

  getVersion: (projectId, versionId) =>
    request(`/projects/${projectId}/versions/${versionId}`),

  /**
   * Server-side import (Python parsers in backend/parsers/). The UI uses the
   * app's own in-browser parsers by default — see ProjectBar.jsx — so this is
   * the fallback path for very large files.
   */
  importFile: (projectId, file, createVersion = true) => {
    const body = new FormData();
    body.append("file", file);
    body.append("create_version", String(createVersion));
    return request(`/projects/${projectId}/import`, { method: "POST", body });
  },
};

/** True when the error looks like "the local backend is not running". */
export function isBackendDown(err) {
  return Boolean(err?.backendDown) || /local backend is not running/i.test(String(err?.message || ""));
}
