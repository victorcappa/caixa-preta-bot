"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribePublicRealtime } from "@/lib/publicRealtime";
import { createOperatorPublicState } from "@/lib/operatorPublic";
import PublicOperatorPanel from "./PublicOperatorPanel";
import OperatorLivePreview from "./OperatorLivePreview";
import styles from "./PublicOperator.module.css";

export default function PublicOperatorControls({ initialExpanded = false, onClose, publicSurface = false, parametersOnly = false } = {}) {
  const [channel, setChannel] = useState(createOperatorPublicState);
  const [show, setShow] = useState({});
  const [connection, setConnection] = useState("connecting");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(initialExpanded);
  const queued = useRef({});
  const running = useRef(null);
  const timer = useRef(null);
  const mounted = useRef(true);
  const initialMessageIds = useRef(null);
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = subscribePublicRealtime(({ state }) => {
      if (state.operatorPublic && initialMessageIds.current === null) {
        initialMessageIds.current = new Set(state.operatorPublic.messages.filter(({ status }) => status !== "streaming").map(({ id }) => id));
      }
      if (state.operatorPublic) setChannel((current) => ({ ...state.operatorPublic,
        ...(running.current || Object.keys(queued.current).length ? { draft: current.draft, personality: current.personality } : {}) }));
      if (state.operatorPublic && !["generating"].includes(state.operatorPublic.status)) setSending(false);
      if (state.sceneZero) setShow(state);
    }, setConnection);
    return () => { mounted.current = false; unsubscribe(); clearTimeout(timer.current); };
  }, []);

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
    try { await task; }
    catch { if (mounted.current) setError("Alteração não sincronizada. Verifique a conexão e tente novamente."); }
    finally { if (running.current === task) running.current = null; }
    if (Object.keys(queued.current).length) await flush();
  }, []);

  function patch(value) {
    setError("");
    queued.current = { ...queued.current, ...value,
      ...(value.personality ? { personality: { ...queued.current.personality, ...value.personality } } : {}) };
    setChannel((current) => ({ ...current, ...value,
      ...(value.personality ? { personality: { ...current.personality, ...value.personality } } : {}) }));
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
    typingSettings={show.robotSound} initialMessageIds={initialMessageIds.current} privateControls={{
    personality: (id, value) => patch({ personality: { [id]: Math.max(0, Math.min(100, value)) } }),
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
      <div className={styles.privateGrid}>
        {panel}
        <OperatorLivePreview state={show} />
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
