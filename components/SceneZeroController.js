"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import InstagramBrowserPanel from "./InstagramBrowserPanel";
import { SCENE_ZERO_GLITCH_LEVELS, SCENE_ZERO_STAGES, sceneZeroStageLabel } from "@/lib/scene-zero/state";
import styles from "./SceneZeroController.module.css";

const PRIMARY_STAGES = [
  ["collection", "COLETA DE DADOS"],
  ["participant", "ESCOLHER PARTICIPANTE"],
  ["suitcases", "JOGO DAS MALAS"],
  ["cake", "É BOLO?"],
  ["singing", "MALA — CANTAR 15s"],
  ["glitch", "GLITCH"],
  ["instagram", "INSTAGRAM"],
  ["collapse", "GLITCH / COLAPSO"],
  ["airport", "AEROPORTO"],
  ["tea", "TEA FOR TWO"]
];

const COLLECTION_RESULTS = [
  ["none", "NINGUÉM"],
  ["few", "POUCOS"],
  ["half", "METADE"],
  ["many", "MUITOS"],
  ["almost_all", "QUASE TODOS"],
  ["all", "TODOS"]
];

function remainingTimer(timer, now) {
  if (timer?.status === "running" && timer.endsAt) {
    return Math.max(0, Math.ceil((Date.parse(timer.endsAt) - now) / 1000));
  }
  return timer?.remainingSeconds ?? 15;
}

export default function SceneZeroController() {
  const [snapshot, setSnapshot] = useState({ sceneZero: null, instagram: null, game: null, suitcase: null });
  const [pending, setPending] = useState("");
  const [detail, setDetail] = useState("");
  const [collectionObservation, setCollectionObservation] = useState("");
  const [notice, setNotice] = useState("SISTEMA PRONTO");
  const [now, setNow] = useState(Date.now());
  const teaAudioRef = useRef(null);

  useEffect(() => {
    fetch("/api/state").then((response) => response.json()).then(setSnapshot).catch(() => setNotice("SEM CONEXÃO"));
    const events = new EventSource("/api/events?client=scene-zero-controller");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setSnapshot(payload.state || {});
    };
    events.onerror = () => setNotice("SSE DESCONECTADO");
    return () => events.close();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  async function sceneAction(action, payload = {}) {
    if (pending) return null;
    setPending(action);
    setNotice(`PROCESSANDO ${action.toUpperCase()}...`);
    try {
      const response = await fetch("/api/scene-zero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, detail, ...payload })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ERRO CENA 0");
      if (data.sceneZero) setSnapshot((current) => ({ ...current, sceneZero: data.sceneZero }));
      setNotice(data.message || action.toUpperCase());
      setDetail("");
      return data;
    } catch (error) {
      setNotice(error.message);
      return null;
    } finally {
      setPending("");
    }
  }

  async function operatorCommand(command) {
    if (pending) return;
    setPending(command);
    try {
      const response = await fetch("/api/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ERRO OPERATOR");
      setNotice(data.message || command);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setPending("");
    }
  }

  function teaAction(action) {
    const audio = teaAudioRef.current;
    if (audio) {
      if (action === "tea-stop") {
        audio.pause();
        audio.currentTime = 0;
      } else {
        audio.currentTime = 0;
        audio.play().catch(() => setNotice("ÁUDIO BLOQUEADO PELO NAVEGADOR"));
      }
    }
    sceneAction(action);
  }

  async function recordCollectionResult(result, estimatedCount = null) {
    const recorded = await sceneAction("collection-record-result", {
      result,
      estimatedCount,
      observation: collectionObservation
    });
    if (recorded) setCollectionObservation("");
  }

  const sceneZero = snapshot.sceneZero || {};
  const collection = sceneZero.collection || {};
  const timer = sceneZero.timer || {};
  const seconds = remainingTimer(timer, now);
  const instagram = snapshot.instagram || {};
  const game = snapshot.game || {};
  const suitcase = snapshot.suitcase || {};
  const participantSelection = sceneZero.participantSelection || {};
  const participantSelectionBusy = ["preparing", "awaiting_invite", "countdown", "roulette"].includes(participantSelection.status);
  const participantCountdown = participantSelection.status === "countdown"
    ? countdownSeconds(participantSelection.countdownEndsAt, now)
    : null;
  const questions = useMemo(() => [...(collection.questions || [])].reverse(), [collection.questions]);

  return (
    <main className={styles.controller}>
      <audio
        preload="auto"
        ref={teaAudioRef}
        src="/api/game-assets?file=audios%2FDoris%20Day%20-%20Tea%20For%20Two%20(1950).mp3"
      />
      <header className={styles.header}>
        <div>
          <p>CENA 0</p>
          <h1>BOT / MALAS</h1>
        </div>
        <dl className={styles.statusGrid}>
          <div><dt>ETAPA ATUAL</dt><dd>{sceneZeroStageLabel(sceneZero.stage)}</dd></div>
          <div><dt>PARTICIPANTE</dt><dd>{sceneZero.currentParticipant?.name || "—"}</dd></div>
          <div><dt>GLITCH</dt><dd>{(sceneZero.glitchLevel || "normal").toUpperCase()}</dd></div>
        </dl>
      </header>

      <section className={styles.stagePanel}>
        <h2>DIREÇÃO DRAMATÚRGICA</h2>
        <p>O botão muda o contexto. A fala é improvisada pelo bot.</p>
        <div className={styles.stageGrid}>
          {PRIMARY_STAGES.map(([stage, label]) => (
            <button
              className={sceneZero.stage === stage ? styles.activeStage : styles.stageButton}
              disabled={Boolean(pending)}
              key={stage}
              onClick={() => sceneAction("set-stage", { stage })}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <label className={styles.detailField}>
          CONTEXTO OPCIONAL PARA A PRÓXIMA AÇÃO
          <input value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Ex.: metade levantou a mão; houve silêncio; alguém hesitou" />
        </label>
      </section>

      <div className={styles.blocks}>
        <ControlBlock title="COLETA">
          <Button onClick={() => sceneAction("collection-new-question")} pending={pending}>NOVA PERGUNTA</Button>
          <Button onClick={() => sceneAction("collection-rephrase")} pending={pending}>REFORMULAR</Button>
          <Button onClick={() => sceneAction("collection-comment")} pending={pending}>COMENTAR RESULTADO</Button>
          <Button onClick={() => sceneAction("collection-refresh-local-context")} pending={pending}>ATUALIZAR CONTEXTO SP</Button>
          <Button danger onClick={() => sceneAction("collection-end")} pending={pending}>ENCERRAR COLETA</Button>
          <div className={styles.quickGrid}>
            {COLLECTION_RESULTS.map(([result, label]) => (
              <Button key={result} onClick={() => recordCollectionResult(result)} pending={pending}>{label}</Button>
            ))}
          </div>
          <div className={styles.quickGrid}>
            {["0", "1", "2", "3", "4", "5+"].map((count) => (
              <Button key={count} onClick={() => recordCollectionResult("count", count)} pending={pending}>{count}</Button>
            ))}
          </div>
          <label className={styles.observationField}>
            OBSERVAÇÃO / CORREÇÃO RÁPIDA
            <input
              value={collectionObservation}
              onChange={(event) => setCollectionObservation(event.target.value)}
              placeholder="Ex.: demoraram; riram; uma pessoa respondeu; plateia confusa"
            />
          </label>
          <Button
            onClick={() => recordCollectionResult("qualitative")}
            pending={pending || !collectionObservation.trim()}
          >REGISTRAR SÓ OBSERVAÇÃO</Button>
          <Readout label="ÚLTIMA PERGUNTA" value={collection.lastQuestion} />
          <Readout label="AÇÃO SOLICITADA" value={collection.lastRequestedAction} />
          <Readout label="ÚLTIMO COMENTÁRIO" value={collection.lastComment} />
          <Readout label="TEMPORIZAÇÃO" value={collection.activeCountdown?.status === "running"
            ? `${countdownSeconds(collection.activeCountdown.endsAt, now)}s / ${collection.activeCountdown.durationSeconds}s`
            : (collection.activeCountdown?.status || "idle").toUpperCase()} />
          <Readout label="DATASET" value={`${collection.questions?.length || 0} intervenções · ${collection.segments?.length || 0} segmentos · ${collection.instructionCount || 0} instruções`} />
          <Readout label="OBEDIÊNCIA" value={collection.obedience
            ? `respostas ${collection.obedience.answered || 0} · resistência ${collection.obedience.resisted || 0} · demora ${collection.obedience.delayed || 0} · confusão ${collection.obedience.confused || 0} · antecipação ${collection.obedience.anticipated || 0}`
            : "—"} />
          <Readout label="CONTEXTO SP" value={collection.localContext?.status === "ready"
            ? `${new Date(collection.localContext.updatedAt).toLocaleString("pt-BR")} — ${collection.localContext.summary}`
            : collection.localContext?.status === "error"
              ? `ERRO — ${collection.localContext.error || "não atualizado"}`
              : (collection.localContext?.status || "idle").toUpperCase()} />
          {questions.length ? <ol className={styles.history}>{questions.slice(0, 8).map((item) => <li key={item.id}>{item.text}</li>)}</ol> : null}
        </ControlBlock>

        <ControlBlock title="PARTICIPANTE">
          <Button primary onClick={() => sceneAction("participant-volunteers")} pending={pending || participantSelectionBusy}>INICIAR SELEÇÃO / 10s</Button>
          <Button onClick={() => sceneAction("choose-another-participant")} pending={pending || participantSelectionBusy}>NOVA ROLETA / OUTRA PESSOA</Button>
          <Readout label="MINI GAME" value={participantSelection.status === "countdown" ? `MÃOS LEVANTADAS — ${participantCountdown}s` : participantSelection.status === "awaiting_invite" ? "AGUARDANDO FIM DA FALA" : (participantSelection.status || "idle").toUpperCase()} />
          <Readout label="NOMES NA ROLETA" value={(participantSelection.candidates || []).map((participant) => participant.name).join(" · ")} />
          <Readout label="COMENTÁRIO DA ROLETA" value={participantSelection.lastComment} />
          <Readout label="PARTICIPANTE ESCOLHIDO" value={sceneZero.currentParticipant?.name} />
          <small>Marcus Garcia e Victor Cappa nunca entram no sorteio.</small>
        </ControlBlock>

        <ControlBlock title="MALAS" wide>
          <Readout label="ESTADO" value={`${suitcase.phase || "IDLE"} / ${suitcase.activeExperience || "—"}`} />
          <Readout label="PESSOA PESQUISADA" value={instagram.browserMode === "person_research"
            ? `${instagram.research?.person || sceneZero.currentParticipant?.name || "—"} / ${(instagram.research?.step || instagram.status || "idle").toUpperCase()}`
            : sceneZero.currentParticipant?.name} />
          <Button onClick={() => operatorCommand("/mala start")} pending={pending}>INICIAR / RETOMAR</Button>
          <Button onClick={() => operatorCommand("/mala 1")} pending={pending}>MALA 1</Button>
          <Button onClick={() => operatorCommand("/mala 2")} pending={pending}>MALA 2</Button>
          <Button onClick={() => operatorCommand("/mala 3")} pending={pending}>MALA 3</Button>
          <Button primary onClick={() => sceneAction("suitcase-research-person")} pending={pending || !sceneZero.currentParticipant?.name}>PESQUISAR PARTICIPANTE</Button>
          <Button onClick={() => sceneAction("suitcase-research-stop")} pending={pending || instagram.browserMode !== "person_research"}>FECHAR PESQUISA</Button>
          <Button danger onClick={() => operatorCommand("/mala abort")} pending={pending}>INTERROMPER JOGO</Button>
          {instagram.browserMode === "person_research" && instagram.embedded && instagram.status !== "DISCONNECTED" ? (
            <div className={styles.instagramPanel}><InstagramBrowserPanel instagram={instagram} /></div>
          ) : null}
        </ControlBlock>

        <ControlBlock title="É BOLO?">
          <Readout label="ESTADO EXISTENTE" value={game.id === "verdade_ou_bolo" ? `${game.phase || "ATIVO"}` : "INATIVO"} />
          <Button onClick={() => sceneAction("cake-comment")} pending={pending}>COMENTAR</Button>
          <Button onClick={() => sceneAction("cake-provoke")} pending={pending}>NOVA PROVOCAÇÃO</Button>
          <Button onClick={() => operatorCommand("/game round")} pending={pending}>PRÓXIMA RODADA</Button>
          <Button onClick={() => operatorCommand("/game verdade")} pending={pending}>VERDADE</Button>
          <Button onClick={() => operatorCommand("/game bolo")} pending={pending}>BOLO</Button>
          <Button onClick={() => operatorCommand("/game reveal")} pending={pending}>REVELAR</Button>
          <Button danger onClick={() => sceneAction("cake-end")} pending={pending}>ENCERRAR É BOLO</Button>
        </ControlBlock>

        <ControlBlock title="CANTAR 15s" wide>
          <div className={`${styles.timer} ${timer.status === "complete" ? styles.timerComplete : ""}`}>{seconds}</div>
          <strong className={styles.timerStatus}>{timer.status === "complete" ? "FIM" : (timer.status || "idle").toUpperCase()}</strong>
          <Button primary onClick={() => sceneAction("timer-start")} pending={pending}>INICIAR TIMER</Button>
          <Button onClick={() => sceneAction("timer-pause")} pending={pending}>PAUSAR</Button>
          <Button onClick={() => sceneAction("timer-resume")} pending={pending}>CONTINUAR</Button>
          <Button onClick={() => sceneAction("timer-restart")} pending={pending}>REINICIAR</Button>
          <Button danger onClick={() => sceneAction("timer-cancel")} pending={pending}>CANCELAR</Button>
        </ControlBlock>

        <ControlBlock title="GLITCH" wide>
          <div className={styles.levels}>
            {SCENE_ZERO_GLITCH_LEVELS.map((level) => (
              <Button primary={sceneZero.glitchLevel === level} key={level} onClick={() => sceneAction("set-glitch", { level })} pending={pending}>
                {level === "normal" ? "NORMAL" : level.replace("glitch-", "GLITCH ").toUpperCase()}
              </Button>
            ))}
          </div>
          <Button onClick={() => sceneAction("step-glitch", { delta: 1 })} pending={pending}>GLITCH +</Button>
          <Button onClick={() => sceneAction("step-glitch", { delta: -1 })} pending={pending}>GLITCH -</Button>
          <Button danger onClick={() => sceneAction("set-glitch", { level: "normal" })} pending={pending}>RESET</Button>
        </ControlBlock>

        <ControlBlock title="INSTAGRAM" wide>
          <Readout label="INTEGRAÇÃO EXISTENTE" value={`${instagram.status || "DISCONNECTED"} / ${instagram.message || "—"}`} />
          <Button primary onClick={() => sceneAction("instagram-start")} pending={pending}>INICIAR INSTAGRAM</Button>
          <Button danger onClick={() => sceneAction("instagram-stop")} pending={pending}>INTERROMPER INSTAGRAM</Button>
          {sceneZero.instagramActive && instagram.embedded && instagram.status !== "DISCONNECTED" ? (
            <div className={styles.instagramPanel}><InstagramBrowserPanel instagram={instagram} /></div>
          ) : null}
        </ControlBlock>

        <ControlBlock title="AEROPORTO / TEA FOR TWO" wide>
          <Readout label="AEROPORTO" value={sceneZero.airportActive ? "TELA ESTÁVEL ATIVA" : "INATIVO"} />
          <Readout label="TEA FOR TWO" value={(sceneZero.teaForTwo?.status || "stopped").toUpperCase()} />
          <Button primary onClick={() => teaAction("tea-play")} pending={pending}>PLAY</Button>
          <Button onClick={() => teaAction("tea-restart")} pending={pending}>RESTART</Button>
          <Button danger onClick={() => teaAction("tea-stop")} pending={pending}>STOP</Button>
        </ControlBlock>
      </div>
      <footer className={styles.notice}>{pending ? `PROCESSANDO: ${pending}` : notice}</footer>
    </main>
  );
}

function ControlBlock({ children, title, wide = false }) {
  return <section className={`${styles.block} ${wide ? styles.wide : ""}`}><h2>{title}</h2><div className={styles.controls}>{children}</div></section>;
}

function Button({ children, danger = false, onClick, pending, primary = false }) {
  return <button className={danger ? styles.danger : primary ? styles.primary : styles.button} disabled={Boolean(pending)} onClick={onClick} type="button">{children}</button>;
}

function Readout({ label, value }) {
  return <p className={styles.readout}><span>{label}</span><strong>{value || "—"}</strong></p>;
}

function countdownSeconds(endsAt, now) {
  return endsAt ? Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 1000)) : 10;
}
