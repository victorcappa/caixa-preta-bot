"use client";
/* eslint-disable @next/next/no-img-element -- Existing local Tarot reference, no remote image pipeline. */
import { useCallback, useEffect, useRef, useState } from "react";
import { subscribePublicRealtime } from "@/lib/publicRealtime";
import ProjectionWindowClient from "./ProjectionWindowClient";
import OperatorTypedReply from "./OperatorTypedReply";
import PostDemoParameters from "./PostDemoParameters";
import PostDemoPointCloud from "./PostDemoPointCloud";
import { postDemoPresentation, POST_DEMO_CARD_LIMIT } from "@/lib/post-demo/settings";
import styles from "./PostDemo.module.css";

export default function PostDemo({ controller = false, panelCollapsed = false, panelReady = true, panelError = "", onTogglePanel }) {
  const [snapshot, setSnapshot] = useState(null), [details, setDetails] = useState(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [typedId, setTypedId] = useState(null);
  const [cloudError, setCloudError] = useState("");
  const [cloudRequest, setCloudRequest] = useState(false);
  const entered = useRef(null), session = useRef(null), textArea = useRef(null), pending = useRef(false);
  const state = snapshot?.postDemo, round = state?.rounds.at(-1);
  const presentation = state?.presentation || postDemoPresentation();
  const dedicatedProjection = Object.values(snapshot?.projection?.windows || {}).some(window => window.connected && window.currentPath?.split("?")[0] === "/pos-demo");
  const display = !controller || !dedicatedProjection;
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
      if (controller && panelReady && session.current && !entered.current) {
        entered.current = session.current;
        void post("enter").catch(failure => setError(failure.message));
      }
      if (controller && (!event || ["post-demo", "post-demo:point-cloud", "snapshot", "reset", "reliability:restored"].includes(event.type))) void refresh();
    });
    if (controller) void refresh();
    return unsubscribe;
  }, [controller, panelReady, post, refresh]);
  useEffect(() => {
    if (!display || !snapshot?.reliability.sessionId) return;
    void post("ready").catch(() => {});
  }, [display, snapshot?.reliability.sessionId, post]);
  useEffect(() => {
    if (!display || !state?.active || state.status !== "presenting" || !round || typedId !== round.id) return;
    const acknowledge = () => void post("ack", { roundId: round.id }).catch(() => {});
    acknowledge(); const timer = setInterval(acknowledge, 2000); return () => clearInterval(timer);
  }, [display, state?.active, state?.status, round, typedId, post]);
  async function action(name, data = {}) {
    if (pending.current) return; pending.current = true; setBusy(true); setError("");
    try { await post(name, data); await refresh(); }
    catch (failure) { setError(failure.message); }
    finally { pending.current = false; setBusy(false); }
  }
  async function generatePointCloud() {
    setCloudError(""); setCloudRequest(true);
    try {
      const response = await fetch("/api/post-demo/point-cloud", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: session.current }) });
      const result = await response.json(); if (!response.ok) throw Error(result.error); await refresh();
    } catch (failure) { setCloudError(failure.message); }
    finally { setCloudRequest(false); }
  }
  const cloud = details?.pointCloud, converting = cloud?.status === "generating";
  const phases = { selecting: "Escolhendo a foto mais recente", image: "Lendo a foto", model: "Carregando o modelo local", depth: "Calculando profundidade", points: "Construindo os pontos", writing: "Preparando a projeção" };
  const message = round && { id: round.id, status: "complete", content: round.content };
  return <main className={styles.surface} data-controller={controller} data-collapsed={panelCollapsed} data-bot-font={presentation.displayFont}>
    <ProjectionWindowClient />
    {controller ? <button type="button" className={styles.panelToggle} disabled={!panelReady} aria-expanded={!panelCollapsed} aria-controls="post-demo-parameters"
      aria-label={panelCollapsed ? "Mostrar parâmetros" : "Recolher parâmetros"} title={panelCollapsed ? "Mostrar parâmetros" : "Recolher parâmetros"}
      onClick={onTogglePanel}>{panelCollapsed ? "☰" : "›"}</button> : null}
    <header className={styles.header}>
      {!controller ? <h1>A ILHA AINDA NÃO EXISTE</h1> : null}
      <span>{state?.totalRounds ? `FRAGMENTO ${state.totalRounds}/${POST_DEMO_CARD_LIMIT}` : "_"}</span>
    </header>
    {panelCollapsed && panelError ? <p role="alert">{panelError}</p> : null}
    <section className={styles.stage} data-cloud={Boolean(state?.pointCloud)} aria-label="Ilha futura da peça">
      {round ? <>
        <figure className={styles.card} key={round.id}><img src={round.card.imageUrl} alt={round.card.name} /><figcaption>{round.card.number} · {round.card.name}</figcaption></figure>
        <div className={styles.voice} ref={textArea} role="log" aria-label="Fala da ilha futura">
          <OperatorTypedReply key={round.id} message={message} settings={presentation} animate={state.status !== "completed"}
            paused={!state.active} onProgress={scroll} onComplete={display ? typed : undefined} />
        </div>
      </> : <p className={styles.cursor} aria-label="Aguardando a ilha">_</p>}
      {state?.status === "generating" ? <span className={styles.drawing}>A PRÓXIMA MARGEM<span>_</span></span> : null}
      {state?.status === "failed" && (!controller || panelCollapsed) ? <p className={styles.suspended}>A ilha ficou em suspenso.</p> : null}
      {state?.pointCloud ? <PostDemoPointCloud key={state.startedAt || "idle"} reference={state.pointCloud} onError={setCloudError} /> : null}
    </section>
    {controller && !panelCollapsed ? <aside className={styles.control} id="post-demo-parameters">
      <p role="status">{state?.status === "completed" ? "PÓS-DEMO CONCLUÍDO · 22/22" : state?.status === "generating" ? "CRIANDO PRÓXIMA CARTA" : state?.active ? "SEQUÊNCIA AUTOMÁTICA" : "PAUSADO"}</p>
      <div className={styles.buttons}>
        <button type="button" disabled={busy || !state || state.status === "completed"} onClick={() => void action(!state.startedAt ? "enter" : state.active ? "pause" : "resume")}>{state?.status === "completed" ? "CONCLUÍDO" : !state?.startedAt ? "INICIAR PÓS-DEMO" : state.active ? "PAUSAR" : "RETOMAR"}</button>
        <button type="button" disabled={busy || !state} title="Recomeçar as cartas e a revelação da nuvem, mantendo os ajustes e a foto." onClick={() => void action("restart")}>RESET</button>
        <a href="/pos-demo" target="_blank" rel="noreferrer">ABRIR PROJEÇÃO</a>
      </div>
      <p>Ajustes exclusivos desta sequência. Salvos automaticamente.</p>
      <section aria-label="Nuvem de pontos da plateia" className={styles.cloudControls}>
        <button type="button" disabled={cloudRequest || converting || !session.current} onClick={() => void generatePointCloud()}>Gerar point cloud</button>
        {converting ? <><p role="status">{phases[cloud.phase] || "Convertendo a foto"} · {cloud.progress}%</p><progress max="100" value={cloud.progress} /></> : null}
        {cloud?.sourceName ? <p>Foto selecionada: {cloud.sourceName}</p> : null}
        {cloud?.status === "ready" ? <p role="status">Nuvem pronta · {cloud.current?.pointCount.toLocaleString("pt-BR")} pontos</p> : null}
        {cloud?.error || cloudError ? <p role="alert">{cloudError || cloud.error}</p> : null}
        <p>Arraste para girar; role para aproximar ou afastar; Shift + arrastar desloca a vista.</p>
      </section>
      {round ? <div className={styles.buttons} aria-label="Avaliar fragmento">{[["perfect", "PERFEITO"], ["almost", "QUASE"], ["bad", "RUIM"]].map(([rating, label]) => <button key={rating} type="button" disabled={busy} aria-pressed={details?.rounds.find(item => item.id === round.id)?.rating === rating} onClick={() => void action("rate", { roundId: round.id, rating })}>{label}</button>)}</div> : null}
      {error ? <p role="alert">{error}</p> : null}
      {panelError ? <p role="alert">{panelError}</p> : null}
      <PostDemoParameters key={snapshot?.reliability.sessionId} config={details?.config} sessionId={snapshot?.reliability.sessionId} />
    </aside> : null}
  </main>;
}
