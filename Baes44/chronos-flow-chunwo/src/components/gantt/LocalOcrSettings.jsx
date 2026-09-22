/**
 * Local OCR cross-check settings (batch 25).
 *
 * Used in two places so the engine can be switched either while importing or from
 * Global Settings → Other:
 *   · ImageImportDialog — the footer row
 *   · GlobalSettingsPanel — "Other" tab
 *
 * The value lives in localStorage (`gantt_local_ocr`), so each surface simply reads
 * it on mount and writes through `saveLocalOcrSettings`.
 */
import { useEffect, useRef, useState } from "react";
import { LOCAL_OCR_ENGINES, engineById, ensureEngineRunning, loadLocalOcrSettings, probeLocalOcr, saveLocalOcrSettings } from "@/lib/localOcr";

export default function LocalOcrSettings() {
  const [settings, setSettings] = useState(() => loadLocalOcrSettings());
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const firstRun = useRef(true);

  /** Probe only. `autoStart` is true when the user just switched engines. */
  const refresh = async (config, autoStart) => {
    setBusy(true);
    setMessage(autoStart ? "checking the service…" : "");
    try {
      const result = autoStart
        ? await ensureEngineRunning(config, {
            onProgress: (text) => setMessage(text),
            waitMs: config.engine === "pstocr" ? 300000 : 120000,
          })
        : { ...(await probeLocalOcr(config)), started: false };
      setStatus(result);
      if (!autoStart || !result.available) setMessage(result.hint || "");
      else if (result.started) setMessage("service started ✓");
    } finally {
      setBusy(false);
      setTimeout(() => setMessage((current) => (current === "service started ✓" ? "" : current)), 6000);
    }
  };

  // Probe on mount (never spawns anything just because a panel was opened).
  useEffect(() => {
    let alive = true;
    probeLocalOcr(settings).then((result) => { if (alive) setStatus(result); });
    return () => { alive = false; };
  }, []);

  // Switching the engine (or its address) tries to start it automatically.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    refresh(settings, true);
  }, [settings.engine, settings.url, settings.model]);

  const update = (patch) => setSettings(saveLocalOcrSettings(patch));
  const engine = engineById(settings.engine);
  const dot = !settings.enabled ? "#b0b0b0" : busy ? "#b15315" : status?.available ? "#005a53" : "#b15315";

  return (
    <div className="text-xs text-text-muted">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          Local OCR cross-check
        </label>
        <select
          value={settings.engine}
          onChange={(e) => update({ engine: e.target.value, url: engineById(e.target.value).defaultUrl })}
          className="px-2 py-1 rounded border border-border bg-surface"
          title={engine.hint}
          aria-label="Local OCR engine"
        >
          {LOCAL_OCR_ENGINES.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
        {engine.needsModel && (
          <input
            type="text"
            value={settings.model}
            onChange={(e) => update({ model: e.target.value })}
            placeholder="model (e.g. ovisocr2:bf)"
            spellCheck={false}
            className="px-2 py-1 rounded border border-border bg-surface font-mono text-[11px]"
            style={{ width: 160 }}
            list="local-ocr-model-options"
            aria-label="Local OCR model"
          />
        )}
        <datalist id="local-ocr-model-options">
          {(status?.models || []).map((name) => <option key={name} value={name} />)}
        </datalist>
        <input
          type="text"
          value={settings.url}
          onChange={(e) => update({ url: e.target.value })}
          spellCheck={false}
          className="px-2 py-1 rounded border border-border bg-surface font-mono text-[11px]"
          style={{ width: 200 }}
          title="Address of the selected local OCR engine"
          aria-label="Local OCR service address"
        />
      </div>
      <div className="flex items-center gap-1 mt-1">
        <span style={{ width: 7, height: 7, borderRadius: 99, display: "inline-block", background: dot }} />
        {!settings.enabled
          ? "off — pages are read by the cloud model only"
          : busy
            ? (message || "checking…")
            : status == null
              ? "checking…"
              : status.available
                ? `ready — ${status.engine}${status.version ? " " + status.version : ""}${status.models?.length ? `（${status.models.length} 個模型${settings.engine === "ollama" && !settings.model ? "，請選一個" : ""}）` : ""}${settings.engine === "ppocr" ? "（每頁約 35 秒）" : ""}`
                : `not reachable — ${status.hint || engine.hint}`}
        {settings.enabled && !busy && status && !status.available && status.canAutoStart !== false && (
          <button
            type="button"
            onClick={() => refresh(settings, true)}
            className="ml-1 px-2 py-0.5 rounded border border-border text-text hover:bg-surface-muted"
          >
            Start now
          </button>
        )}
      </div>
    </div>
  );
}
