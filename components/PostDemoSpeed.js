"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { subscribePublicRealtime } from "@/lib/publicRealtime";

export default function PostDemoSpeed() {
  const [value, setValue] = useState(8000), [ready, setReady] = useState(false), [error, setError] = useState("");
  const session = useRef(null), draft = useRef(null), running = useRef(false), timer = useRef(null), mounted = useRef(true);
  const save = useCallback(async function save() {
    if (running.current || draft.current === null) return;
    running.current = true;
    let succeeded = false;
    const selected = draft.current; draft.current = null;
    try {
      const response = await fetch("/api/post-demo", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "config", cardHoldMs: selected, sessionId: session.current }), keepalive: true, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error();
      succeeded = true;
      if (mounted.current) setError("");
    } catch { if (mounted.current) { draft.current ??= selected; setError("Intervalo não salvo. Tente novamente."); } }
    finally { running.current = false; }
    if (succeeded && draft.current !== null) { if (mounted.current) timer.current = setTimeout(save, 150); else void save(); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = subscribePublicRealtime(({ state }) => {
      session.current = state.reliability?.sessionId;
      setReady(Boolean(state.postDemo?.config));
      if (state.postDemo?.config && draft.current === null && !running.current) setValue(state.postDemo.config.cardHoldMs);
    });
    return () => { mounted.current = false; unsubscribe(); clearTimeout(timer.current); if (draft.current !== null) void save(); };
  }, [save]);
  return <section aria-label="Velocidade do pós-demo" style={{ border: "1px solid #237541", padding: 16 }}>
    <h3>PÓS-DEMO · RITMO DAS CARTAS</h3>
    <label htmlFor="post-demo-speed">Intervalo entre cartas <output>{value / 1000}s</output></label>
    <input id="post-demo-speed" aria-label="Intervalo entre cartas do pós-demo" type="range" min="1000" max="60000" step="1000"
      value={value} disabled={!ready} style={{ width: "100%" }} onChange={event => {
        const selected = Number(event.target.value); setValue(selected); draft.current = selected; setError("");
        clearTimeout(timer.current); timer.current = setTimeout(save, 150);
      }} onPointerUp={() => void save()} onKeyUp={() => void save()} onBlur={() => void save()} />
    <p>Contado após a fala terminar de aparecer. A velocidade das letras segue a digitação do robô.</p>
    {!ready ? <p>Pós-demo disponível após carregar o novo canal no servidor.</p> : null}
    {error ? <p role="alert">{error} <button type="button" onClick={() => void save()}>TENTAR NOVAMENTE</button></p> : null}
  </section>;
}
