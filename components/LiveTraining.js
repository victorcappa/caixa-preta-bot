"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribePublicRealtime } from "@/lib/publicRealtime";
import { liveTrainingTypingDelayMs } from "@/lib/liveTrainingTyping";
import OperatorTypedReply from "./OperatorTypedReply";
import ProjectionWindowClient from "./ProjectionWindowClient";
import PublicOperatorControls from "./PublicOperatorControls";
import styles from "./LiveTraining.module.css";

const ratings = [["perfect", "PERFEITO"], ["almost", "QUASE"], ["bad", "RUIM"]];

export default function LiveTraining({ controller = false }) {
  const [channel, setChannel] = useState({ messages: [], status: "idle" });
  const [settings, setSettings] = useState({});
  const [feedback, setFeedback] = useState({});
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const historyRef = useRef(null), baseline = useRef(null), sessionRef = useRef(null), pendingRef = useRef(false), retry = useRef(null);
  const scroll = useCallback(() => { const element = historyRef.current; if (element) element.scrollTop = element.scrollHeight; }, []);
  const rememberFeedback = useCallback(value => {
    setFeedback(Object.fromEntries((value?.messages || []).filter(message => message.rating).map(message => [message.id, message.rating])));
  }, []);

  useEffect(() => {
    let active = true;
    const refreshPrivate = async () => {
      try {
        const response = await fetch("/api/live-training", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) { if (active) setError(data.error || "Conexão indisponível."); return; }
        if (active && (!sessionRef.current || data.sessionId === sessionRef.current)) {
          rememberFeedback(data.liveTraining);
          setError(data.liveTraining?.error || "");
        }
      } catch { /* The public reconciliation loop handles connection recovery. */ }
    };
    const unsubscribe = subscribePublicRealtime(({ event, state }) => {
      if (!state.liveTraining) return;
      if (sessionRef.current !== state.reliability?.sessionId) {
        sessionRef.current = state.reliability?.sessionId;
        baseline.current = new Set(state.liveTraining.messages.filter(message => message.status !== "streaming").map(message => message.id));
        retry.current = null;
        setFeedback({});
        setError("");
        setInput("");
        if (controller) void refreshPrivate();
      }
      setSessionId(state.reliability?.sessionId);
      setChannel(state.liveTraining);
      setSettings(state.robotSound || {});
      if (controller && event?.type === "live-training-feedback") void refreshPrivate();
    });
    if (controller) void refreshPrivate();
    return () => { active = false; unsubscribe(); };
  }, [controller, rememberFeedback]);

  useEffect(scroll, [channel, scroll]);

  async function action(body) {
    if (pendingRef.current || !sessionId) return false;
    pendingRef.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/live-training", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, sessionId }), signal: AbortSignal.timeout(22000) });
      const data = await response.json();
      if (sessionRef.current !== sessionId) return false;
      if (!response.ok) throw new Error(data.error || "Não foi possível concluir. Tente novamente.");
      if (data.liveTraining) rememberFeedback(data.liveTraining);
      return true;
    } catch (failure) {
      if (sessionRef.current === sessionId) setError(failure.name === "TimeoutError" ? "A resposta demorou. Sua mensagem foi mantida para tentar novamente." : failure.message);
      return false;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function send(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || pendingRef.current || channel.status !== "idle") return;
    const requestId = retry.current?.text === text ? retry.current.requestId : crypto.randomUUID();
    const sentSession = sessionId;
    retry.current = { text, requestId };
    setInput("");
    if (await action({ action: "send", text, requestId })) retry.current = null;
    else if (sessionRef.current === sentSession) setInput(text);
  }

  return <main className={styles.surface} data-controller={controller}>
    {!controller ? <ProjectionWindowClient /> : null}
    <header className={styles.header}>
      <span>CAIXA PRETA</span>
      <h1>{controller ? "treino-ao-vivo" : "INCONSCIENTE COLETIVO"}</h1>
    </header>
    <div className={styles.history} ref={historyRef} role="log" aria-label="Conversa do treino ao vivo" aria-live="off">
      {!channel.messages.length ? <p className={styles.empty} aria-hidden="true"><span>_</span></p> : null}
      {channel.messages.map(message => <article key={message.id} data-message-id={message.id} data-role={message.role} className={styles.message}>
        <small>{message.role === "user" ? "VOCÊ" : message.kind === "alternative" ? "CAIXA · ALTERNATIVA" : "CAIXA PRETA"}</small>
        {message.role === "assistant" ? <OperatorTypedReply message={message} settings={settings} typingDelay={liveTrainingTypingDelayMs}
          animate={!baseline.current?.has(message.id)} onProgress={scroll} /> : <p>{message.content}</p>}
        {message.status === "failed" || message.status === "cancelled" ? <span className={styles.interrupted}>Resposta interrompida.</span> : null}
        {controller && message.role === "assistant" ? <div className={styles.feedback} aria-label="Avaliar resposta">
          {ratings.map(([rating, label]) => <button key={rating} type="button" aria-pressed={feedback[message.id] === rating}
            data-rating={rating} disabled={pending || message.status !== "complete"}
            onClick={() => action({ action: "rate", messageId: message.id, rating })}>{label}</button>)}
          <button type="button" disabled={pending || channel.status !== "idle" || message.status !== "complete"}
            onClick={() => action({ action: "alternatives", messageId: message.id, requestId: crypto.randomUUID() })}>GERAR ALTERNATIVAS</button>
        </div> : null}
      </article>)}
      {channel.status === "generating" && !channel.messages.at(-1)?.content ? <p className={styles.waiting}>A Caixa está escrevendo<span aria-hidden="true">...</span></p> : null}
      {channel.status === "alternatives" ? <p className={styles.waiting}>Outras possibilidades<span aria-hidden="true">...</span></p> : null}
    </div>
    {controller ? <aside className={styles.parameters} aria-label="Parâmetros compartilhados do bot"><PublicOperatorControls parametersOnly /></aside> : null}
    {controller ? <form className={styles.composer} onSubmit={send}>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      <div><textarea id="live-training-message" aria-label="Mensagem" value={input} maxLength={4000} rows={2}
        disabled={pending || channel.status !== "idle" || !sessionId}
        onChange={event => setInput(event.target.value)} onKeyDown={event => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(event); }
        }} />
        <button type="submit" disabled={pending || channel.status !== "idle" || !input.trim() || !sessionId}>ENVIAR</button></div>
    </form> : null}
  </main>;
}
