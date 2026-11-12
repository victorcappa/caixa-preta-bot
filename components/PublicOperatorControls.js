"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribePublicRealtime } from "@/lib/publicRealtime";
import { createOperatorPublicState, EXPRESSION_PARAMETERS } from "@/lib/operatorPublic";
import PublicCompositionControls from "./PublicCompositionControls";
import PublicOperatorPanel from "./PublicOperatorPanel";
import OperatorLivePreview from "./OperatorLivePreview";
import styles from "./PublicOperator.module.css";

export default function PublicOperatorControls({ initialExpanded = false, onClose, publicSurface = false, parametersOnly = false } = {}) {
  const [channel, setChannel] = useState(createOperatorPublicState);
  const [profile, setProfile] = useState(null);
  const [show, setShow] = useState({});
  const [connection, setConnection] = useState("connecting");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(initialExpanded);
  const queued = useRef({});
  const running = useRef(null);
  const inFlightPatch = useRef({});
  const readSequence = useRef(0);
  const timer = useRef(null);
  const mounted = useRef(true);
  const initialMessageIds = useRef(null);
  const refreshParameters = useCallback(async () => {
    if (!parametersOnly) return;
    const sequence = ++readSequence.current;
    try {
      const response = await fetch("/api/operator-public", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error("PARAMETERS_UNAVAILABLE");
      if (!mounted.current || sequence !== readSequence.current) return;
      const dirtyProfile = { ...inFlightPatch.current.profile, ...queued.current.profile };
      const dirtyPersonality = { ...inFlightPatch.current.personality, ...queued.current.personality };
      setProfile({ ...data.profile, ...dirtyProfile });
      setChannel(current => ({ ...current, personality: { ...data.personality, ...dirtyPersonality } }));
    } catch { if (mounted.current) setError("Parâmetros indisponíveis. Verifique a conexão."); }
  }, [parametersOnly]);
  useEffect(() => {
    mounted.current = true;
    if (parametersOnly) void refreshParameters();
    const unsubscribe = subscribePublicRealtime(({ state, event }) => {
      if (state.operatorPublic && initialMessageIds.current === null) {
        initialMessageIds.current = new Set(state.operatorPublic.messages.filter(({ status }) => status !== "streaming").map(({ id }) => id));
      }
      if (state.operatorPublic) setChannel(() => ({ ...state.operatorPublic,
        ...(("draft" in inFlightPatch.current || "draft" in queued.current) ? { draft: queued.current.draft ?? inFlightPatch.current.draft } : {}),
        personality: { ...state.operatorPublic.personality, ...inFlightPatch.current.personality, ...queued.current.personality } }));
      if (state.operatorPublic && !["generating"].includes(state.operatorPublic.status)) setSending(false);
      if (state.sceneZero) setShow(state);
      if (!event || ["snapshot", "operator-public", "tarot", "reset", "reliability:restored"].includes(event.type)) void refreshParameters();
    }, setConnection);
    return () => { mounted.current = false; unsubscribe(); clearTimeout(timer.current); };
  }, [parametersOnly, refreshParameters]);

  async function post(body) {
    const response = await fetch("/api/operator-public", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Falha de comunicação");
    return result;
  }

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (running.current) { await running.current.catch(() => {}); }
    if (!Object.keys(queued.current).length) return;
    const patch = queued.current;
    queued.current = {};
    const task = post({ action: "patch", ...patch });
    running.current = task;
    inFlightPatch.current = patch;
    try { await task; }
    catch { if (mounted.current) setError("Alteração não sincronizada. Verifique a conexão e tente novamente."); }
    finally { if (running.current === task) { running.current = null; inFlightPatch.current = {}; } }
    if (Object.keys(queued.current).length) await flush();
    else await refreshParameters();
  }, [refreshParameters]);

  function patch(value) {
    setError("");
    queued.current = { ...queued.current, ...value,
      ...(value.personality ? { personality: { ...queued.current.personality, ...value.personality } } : {}),
      ...(value.profile ? { profile: Object.keys(value.profile).length ? { ...queued.current.profile, ...value.profile } : {} } : {}) };
    setChannel((current) => ({ ...current, ...value,
      ...(value.personality ? { personality: { ...current.personality, ...value.personality } } : {}) }));
    if (value.profile) setProfile(current => Object.keys(value.profile).length ? { ...current, ...value.profile } : {});
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 60);
  }

  async function action(name) {
    setError("");
    try {
      if (name !== "cancel") await flush();
      if (name === "send" && !channel.draft.trim()) return;
      if (name !== "cancel") setSending(true);
      const task = post({ action: name, text: channel.draft, requestId: crypto.randomUUID() });
      if (name === "send") setChannel((current) => ({ ...current, draft: "" }));
      const result = await task;
      if (result.generationError) setError("A IA ficou indisponível. A cena permanece sob controle; a resposta pode ter sido interrompida ou usada como fallback local.");
    } catch { setError("Não foi possível concluir. Os controles da peça continuam disponíveis."); }
    finally { if (mounted.current) setSending(false); }
  }
  const busy = sending || channel.status === "generating";
  const inputId = publicSurface ? "public-operator-input" : "operator-public-input";
  const panel = <PublicOperatorPanel channel={channel} connection={connection} publicSurface={publicSurface} parametersOnly={parametersOnly}
    profile={parametersOnly ? profile : null}
    typingSettings={show.robotSound} initialMessageIds={initialMessageIds.current} privateControls={{
    personality: (id, value) => patch({ personality: { [id]: Math.max(0, Math.min(100, value)) } }),
    profile: (id, value) => patch({ profile: id ? { [id]: Math.max(0, Math.min(100, value)) } : Object.fromEntries(EXPRESSION_PARAMETERS.map(({ id }) => [id, 50])) }),
    input: <form className={styles.input} onSubmit={(event) => { event.preventDefault(); if (!busy) void action("send"); }}>
      <label htmlFor={inputId}>OPERADOR &gt; {!publicSurface ? <small>Texto visível à plateia quando revelado</small> : null}</label>
      <textarea id={inputId} value={channel.draft} maxLength={4000} rows={2}
        onChange={(event) => patch({ draft: event.target.value })}
        onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy) void action("send"); } }} />
      <div><button type="submit" disabled={busy || !channel.draft.trim()}>ENVIAR</button><button type="button" disabled={!busy} onClick={() => void action("cancel")}>INTERROMPER GERAÇÃO</button></div>
      {publicSurface && error ? <small role="status">Envio não confirmado. Tente novamente.</small> : null}
    </form>
  }} />;
  if (parametersOnly) return (
    <div className={`${styles.controls} ${styles.parametersOnly}`}>
      {panel}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
  if (publicSurface) return <div className={styles.publicControls}>{panel}</div>;
  return (
    <section className={`${styles.controls} ${expanded ? styles.expanded : ""}`} aria-label="Operação pública interativa">
      <div className={styles.privateBar}>
        <button type="button" aria-pressed={expanded} onClick={() => { if (expanded && onClose) onClose(); else setExpanded((current) => !current); }}>{expanded ? "VOLTAR AOS CONTROLES" : "AMPLIAR CONVERSA"}</button>
        <button type="button" aria-pressed={channel.visible} onClick={() => patch({ visible: !channel.visible })}>{channel.visible ? "OCULTAR OPERATOR" : "REVELAR OPERATOR"}</button>
        <button type="button" onClick={() => void action("return")}>INTERROMPER DESVIO / RETOMAR PEÇA</button>
      </div>
      <PublicCompositionControls />
      <div className={styles.privateGrid}>
        {panel}
        <OperatorLivePreview state={show} />
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
