"use client";
/* eslint-disable @next/next/no-img-element -- Existing local Tarot reference, no remote image pipeline. */
import { useCallback, useEffect, useRef, useState } from "react";
import { subscribePublicRealtime } from "@/lib/publicRealtime";
import ProjectionWindowClient from "./ProjectionWindowClient";
import OperatorTypedReply from "./OperatorTypedReply";
import PostDemoParameters from "./PostDemoParameters";
import { postDemoPresentation } from "@/lib/post-demo/settings";
import styles from "./PostDemo.module.css";

export default function PostDemo({ controller = false }) {
  const [snapshot, setSnapshot] = useState(null), [details, setDetails] = useState(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [typedId, setTypedId] = useState(null);
  const entered = useRef(null), session = useRef(null), textArea = useRef(null), pending = useRef(false);
  const state = snapshot?.postDemo, round = state?.rounds.at(-1);
  const presentation = state?.presentation || postDemoPresentation();
  const scroll = useCallback(() => { if (textArea.current) textArea.current.scrollTop = textArea.current.scrollHeight; }, []);
  const typed = useCallback(id => setTypedId(id), []);
  const refresh = useCallback(async () => {
    if (!controller) return;
    try {
      const response = await fetch("/api/post-demo", { cache: "no-store" }); const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.sessionId === session.current) { setDetails(data.postDemo); setError(data.postDemo.error || ""); }
    } catch (failure) { setError(failure.message || "Conexão indisponível."); }
  }, [controller]);
  const post = useCallback(async (action, data = {}) => {
    const response = await fetch("/api/post-demo", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data, sessionId: session.current }), signal: AbortSignal.timeout(12000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível concluir.");
  }, []);
  useEffect(() => {
    const unsubscribe = subscribePublicRealtime(({ state: next, event }) => {
      if (session.current !== next.reliability?.sessionId) { session.current = next.reliability?.sessionId; setDetails(null); setTypedId(null); }
      setSnapshot(next);
      if (controller && session.current && !entered.current) {
        entered.current = session.current;
        void post("enter").catch(failure => setError(failure.message));
      }
      if (controller && (!event || ["post-demo", "snapshot", "reset", "reliability:restored"].includes(event.type))) void refresh();
    });
    if (controller) void refresh();
    return unsubscribe;
  }, [controller, post, refresh]);
  useEffect(() => {
    if (controller || !snapshot?.reliability.sessionId) return;
    void post("ready").catch(() => {});
  }, [controller, snapshot?.reliability.sessionId, post]);
  useEffect(() => {
    if (controller || !state?.active || state.status !== "presenting" || !round || typedId !== round.id) return;
    const acknowledge = () => void post("ack", { roundId: round.id }).catch(() => {});
    acknowledge(); const timer = setInterval(acknowledge, 2000); return () => clearInterval(timer);
  }, [controller, state?.active, state?.status, round, typedId, post]);
  async function action(name, data = {}) {
    if (pending.current) return; pending.current = true; setBusy(true); setError("");
    try { await post(name, data); await refresh(); }
    catch (failure) { setError(failure.message); }
    finally { pending.current = false; setBusy(false); }
  }
  const message = round && { id: round.id, status: "complete", content: round.content };
  return <main className={styles.surface} data-controller={controller} data-bot-font={presentation.displayFont}>
    {!controller ? <ProjectionWindowClient /> : null}
    <header className={styles.header}><h1>{controller ? "pós-demo" : "A ILHA AINDA NÃO EXISTE"}</h1><span>{state?.totalRounds ? `FRAGMENTO ${state.totalRounds}` : "_"}</span></header>
    <section className={styles.stage} aria-label="Ilha futura da peça">
      {round ? <>
        <figure className={styles.card} key={round.id}><img src={round.card.imageUrl} alt={round.card.name} /><figcaption>{round.card.number} · {round.card.name}</figcaption></figure>
        <div className={styles.voice} ref={textArea} role="log" aria-label="Fala da ilha futura">
          <OperatorTypedReply key={round.id} message={message} settings={presentation} animate
            paused={!state.active} onProgress={scroll} onComplete={controller ? undefined : typed} />
        </div>
      </> : <p className={styles.cursor} aria-label="Aguardando a ilha">_</p>}
      {state?.status === "generating" ? <span className={styles.drawing}>A PRÓXIMA MARGEM<span>_</span></span> : null}
      {state?.status === "failed" && !controller ? <p className={styles.suspended}>A ilha ficou em suspenso.</p> : null}
    </section>
    {state?.audienceNames?.length ? <footer className={styles.roster} aria-label="Habitantes possíveis da ilha"><small>HABITANTES POSSÍVEIS</small><div className={styles.names}>{state.audienceNames.map(name => <span key={name}>{name}</span>)}</div></footer> : null}
    {controller ? <aside className={styles.control}>
      <p role="status">{state?.status === "generating" ? "CRIANDO PRÓXIMA CARTA" : state?.active ? "SEQUÊNCIA AUTOMÁTICA" : "PAUSADO"}</p>
      <div className={styles.buttons}>
        <button type="button" disabled={busy || !state} onClick={() => void action(!state.startedAt ? "enter" : state.active ? "pause" : "resume")}>{!state?.startedAt ? "INICIAR PÓS-DEMO" : state.active ? "PAUSAR" : "RETOMAR"}</button>
        <button type="button" disabled={busy || !state?.startedAt} onClick={() => void action("restart")}>RECOMEÇAR PÓS-DEMO</button>
        <a href="/pos-demo" target="_blank" rel="noreferrer">ABRIR PROJEÇÃO</a>
      </div>
      <p>Ajustes exclusivos desta sequência. Salvos automaticamente.</p>
      {round ? <div className={styles.buttons} aria-label="Avaliar fragmento">{[["perfect", "PERFEITO"], ["almost", "QUASE"], ["bad", "RUIM"]].map(([rating, label]) => <button key={rating} type="button" disabled={busy} aria-pressed={details?.rounds.find(item => item.id === round.id)?.rating === rating} onClick={() => void action("rate", { roundId: round.id, rating })}>{label}</button>)}</div> : null}
      {error ? <p role="alert">{error}</p> : null}
      <PostDemoParameters key={snapshot?.reliability.sessionId} config={details?.config} sessionId={snapshot?.reliability.sessionId} />
    </aside> : null}
  </main>;
}
