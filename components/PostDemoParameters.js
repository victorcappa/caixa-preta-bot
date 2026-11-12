"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { normalizePostDemoConfig, patchPostDemoConfig } from "@/lib/post-demo/settings";
import { OPENAI_MODEL_OPTIONS } from "@/lib/openaiModels";
import { ROBOT_DISPLAY_FONTS } from "@/lib/robot-sound/state";
import { EXPRESSION_PARAMETERS } from "@/lib/operatorPublic";
import PublicOperatorPanel from "./PublicOperatorPanel";

const merge = (base, patch) => ({ ...base, ...patch,
  ...(base.personality || patch.personality ? { personality: { ...base.personality, ...patch.personality } } : {}),
  ...(base.profile || patch.profile ? { profile: { ...base.profile, ...patch.profile } } : {}) });

export default function PostDemoParameters({ config, sessionId }) {
  const [value, setValue] = useState(() => normalizePostDemoConfig(config)), [error, setError] = useState("");
  const pending = useRef({}), flight = useRef(null), timer = useRef(null), mounted = useRef(true);
  const save = useCallback(async function save() {
    if (flight.current || !Object.keys(pending.current).length || !sessionId) return;
    const patch = pending.current; pending.current = {}; flight.current = patch;
    let succeeded = false;
    try {
      const response = await fetch("/api/post-demo", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "config", config: patch, sessionId }), keepalive: true, signal: AbortSignal.timeout(10000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      succeeded = true;
      if (mounted.current) setError("");
    } catch (failure) {
      pending.current = merge(patch, pending.current);
      if (mounted.current) setError(failure.message || "Parâmetros não salvos.");
    } finally { flight.current = null; }
    if (succeeded && Object.keys(pending.current).length) {
      if (mounted.current) timer.current = setTimeout(save, 150); else void save();
    }
  }, [sessionId]);
  useEffect(() => {
    if (config) setValue(patchPostDemoConfig(config, merge(flight.current || {}, pending.current)));
  }, [config]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimeout(timer.current); void save(); };
  }, [save]);
  function change(patch) {
    setValue(current => patchPostDemoConfig(current, patch));
    pending.current = merge(pending.current, patch); setError("");
    clearTimeout(timer.current); timer.current = setTimeout(save, 150);
  }
  return <section aria-label="Parâmetros exclusivos do pós-demo">
    <h3>RITMO DO PÓS-DEMO</h3>
    {[["typingIntervalMs", "Tempo por letra do pós-demo", 20, 200, 5],
      ["typingPauseMs", "Pausa na pontuação do pós-demo", 0, 2000, 50],
      ["cardHoldMs", "Intervalo entre cartas do pós-demo", 1000, 120000, 1000]].map(([id, label, min, max, step]) => <div key={id}>
      <label htmlFor={`post-demo-${id}`}>{label} <output>{id === "cardHoldMs" ? `${value[id] / 1000}s` : `${value[id]}ms`}</output></label>
      <input id={`post-demo-${id}`} type="range" aria-label={label} min={min} max={max} step={step} value={value[id]} disabled={!config}
        onChange={event => change({ [id]: Number(event.target.value) })} onPointerUp={() => void save()} onKeyUp={() => void save()} onBlur={() => void save()} />
    </div>)}
    <p>O intervalo entre cartas começa depois que a fala termina de aparecer na projeção.</p>
    <label htmlFor="post-demo-model">Modelo do pós-demo</label>
    <select id="post-demo-model" value={value.model} disabled={!config} onChange={event => change({ model: event.target.value })}>
      {OPENAI_MODEL_OPTIONS.map(model => <option key={model} value={model}>{model}</option>)}
    </select>
    <label htmlFor="post-demo-font">Fonte do pós-demo</label>
    <select id="post-demo-font" value={value.displayFont} disabled={!config} onChange={event => change({ displayFont: event.target.value })}>
      {Object.entries(ROBOT_DISPLAY_FONTS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </select>
    <PublicOperatorPanel parametersOnly parameterTitle="PERSONALIDADE DO PÓS-DEMO" channel={{ personality: value.personality }} profile={value.profile}
      privateControls={config ? { personality: (id, selected) => change({ personality: { [id]: selected } }),
        profile: (id, selected) => change({ profile: id ? { [id]: selected } : Object.fromEntries(EXPRESSION_PARAMETERS.map(({ id }) => [id, 50])) }) } : null} />
    {error ? <p role="alert">{error} <button type="button" onClick={() => void save()}>TENTAR NOVAMENTE</button></p> : null}
  </section>;
}
