"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Terminal from "./Terminal";
import styles from "./OperatorConsole.module.css";

export default function OperatorConsole({ embedded = false, terminalClassName = "" } = {}) {
  const [command, setCommand] = useState("");
  const [logs, setLogs] = useState([]);
  const [state, setState] = useState({
    memories: [],
    conversation: [],
    mode: "host",
    previousMode: null,
    modeStartedAt: null,
    model: "gpt-5-mini",
    variables: {},
    context: {
      knowledge: { loaded: false, count: 0 },
      modelOptions: ["gpt-5-mini", "gpt-5-nano"],
      promptVersion: 1
    }
  });
  const [status, setStatus] = useState("CONNECTING");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetch("/api/state")
      .then((response) => response.json())
      .then((data) => setState(data))
      .catch(() => setStatus("DISCONNECTED"));

    const events = new EventSource("/api/events");
    events.onopen = () => setStatus("CONNECTED");
    events.onerror = () => setStatus("DISCONNECTED");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setState({
        ...payload.state,
        context: payload.context
      });
    };

    return () => events.close();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [logs, state]);

  const addLog = useCallback((line, kind = "line") => {
    setLogs((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        kind,
        line
      }
    ]);
  }, []);

  const emitStopAllSignal = useCallback((raw) => {
    if (raw.trim().split(/\s+/)[0] === "/stopall") {
      window.dispatchEvent(new CustomEvent("caixa-preta:stopall"));
    }
  }, []);

  const postOperatorCommand = useCallback(async (raw, timeoutMs = 50000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch("/api/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: raw }),
        signal: controller.signal
      });
      const data = await response.json();
      return { response, data };
    } finally {
      clearTimeout(timer);
    }
  }, []);

  async function submitCommand(event) {
    event.preventDefault();

    const raw = command.trim();
    const commandName = raw.split(/\s+/)[0];
    if (!raw || (pending && commandName !== "/stopall")) {
      return;
    }

    setCommand("");
    addLog(`> ${raw}`, "input");
    emitStopAllSignal(raw);

    if (!raw.startsWith("/")) {
      addLog("COMMAND REQUIRED", "error");
      return;
    }

    if (![
      "/memory",
      "/say",
      "/reset",
      "/malas",
      "/mala",
      "/suitcase",
      "/event",
      "/draw",
      "/game",
      "/activity",
      "/intensity",
      "/model",
      "/instagram",
      "/phone",
      "/clear",
      "/clear-performance",
      "/stopall"
    ].includes(commandName)) {
      addLog(`UNKNOWN COMMAND: ${commandName}`, "error");
      return;
    }

    setPending(true);

    try {
      const { response, data } = await postOperatorCommand(raw);

      if (!response.ok) {
        addLog(data.error || "OPERATOR ERROR", "error");
        return;
      }

      addLog(data.message, "ok");
    } catch (error) {
      addLog(error.name === "AbortError" ? "OPERATOR REQUEST TIMEOUT" : "SERVER CONNECTION FAILED", "error");
    } finally {
      setPending(false);
    }
  }

  async function changeModel(model) {
    if (!model || pending || model === state.model) {
      return;
    }

    addLog(`> /model ${model}`, "input");
    setPending(true);

    try {
      const { response, data } = await postOperatorCommand(`/model ${model}`);

      if (!response.ok) {
        addLog(data.error || "MODEL ERROR", "error");
        return;
      }

      addLog(data.message, "ok");
    } catch (error) {
      addLog(error.name === "AbortError" ? "OPERATOR REQUEST TIMEOUT" : "SERVER CONNECTION FAILED", "error");
    } finally {
      setPending(false);
    }
  }

  const sendOperatorCommand = useCallback(async (raw, fallback = "OPERATOR ERROR") => {
    if (pending && raw.trim().split(/\s+/)[0] !== "/stopall") {
      return;
    }

    addLog(`> ${raw}`, "input");
    emitStopAllSignal(raw);
    setPending(true);

    try {
      const { response, data } = await postOperatorCommand(raw);

      if (!response.ok) {
        addLog(data.error || fallback, "error");
        return;
      }

      addLog(data.message, "ok");
    } catch (error) {
      addLog(error.name === "AbortError" ? "OPERATOR REQUEST TIMEOUT" : "SERVER CONNECTION FAILED", "error");
    } finally {
      setPending(false);
    }
  }, [addLog, emitStopAllSignal, pending, postOperatorCommand]);

  async function toggleInstagramAudio() {
    const muted = !(state.instagram?.audioMuted === false);
    const nextMuted = !muted;
    addLog(`> INSTAGRAM AUDIO ${nextMuted ? "OFF" : "ON"}`, "input");
    setPending(true);

    try {
      const response = await fetch("/api/instagram/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muted: nextMuted })
      });
      const data = await response.json();

      if (!response.ok) {
        addLog(data.error || "INSTAGRAM AUDIO ERROR", "error");
        return;
      }

      addLog(data.message, "ok");
    } catch {
      addLog("INSTAGRAM AUDIO ERROR", "error");
    } finally {
      setPending(false);
    }
  }

  const latestMemories = state.memories.slice(-5).reverse();
  const performanceLog = (state.performance?.eventLog || []).slice(-8).reverse();
  const activities = state.performance?.activities || [];
  const phoneProjection = state.performance?.phoneProjection || { status: "hidden" };
  const game = state.game || { active: false, id: null, cooldownTurnsRemaining: 0 };
  const verdadeOuBolo = game.id === "verdade_ou_bolo" ? game : null;
  const suitcase = state.suitcase || { active: false, phase: "IDLE" };
  const instagram = state.instagram || { status: "DISCONNECTED", logs: [] };
  const instagramLogs = (instagram.logs || []).slice(-5).reverse();
  const suitcaseGame = suitcase.currentGame || null;
  const participantCounts = state.participants?.counts || { team: 0, audience: 0, session: 0, available: 0 };
  const participantHistory = Object.values(state.participants?.history || {})
    .sort((a, b) => (b.selectedCount || 0) - (a.selectedCount || 0))
    .slice(0, 4);
  const modelOptions = state.context?.modelOptions || ["gpt-5-mini", "gpt-5-nano"];
  const variableCount = Object.keys(state.variables || {}).length;
  const footer = (
    <form className={styles.form} onSubmit={submitCommand}>
      <span aria-hidden="true">&gt;</span>
      <input
        aria-label="Comando do operator"
        autoComplete="off"
        value={command}
        onChange={(event) => setCommand(event.target.value)}
      />
    </form>
  );

  useEffect(() => {
    if (!verdadeOuBolo?.active) {
      return undefined;
    }

    function isTypingTarget(target) {
      const tagName = target?.tagName?.toLowerCase();
      return ["input", "textarea", "select"].includes(tagName) || target?.isContentEditable;
    }

    function handleGameShortcut(event) {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const videoAction = verdadeOuBolo.data?.videoCommand?.action;
      const gameState = verdadeOuBolo.data?.state;
      let commandForKey = null;

      if (event.key === " ") {
        commandForKey = gameState === "INTRO" ? null : videoAction === "play" ? "/game pause" : "/game play";
      }

      if (event.key === "1" && ["QUESTION", "ANSWER_LOCKED", "VOTING"].includes(gameState)) {
        commandForKey = "/game verdade";
      }

      if (event.key === "2" && ["QUESTION", "ANSWER_LOCKED", "VOTING"].includes(gameState)) {
        commandForKey = "/game bolo";
      }

      if (event.key === "Enter") {
        if (gameState === "INTRO") {
          commandForKey = "/game round";
        } else if (["QUESTION", "ANSWER_LOCKED", "REVEAL", "ROUND_RESULT"].includes(gameState)) {
          commandForKey = "/game reveal";
        }
      }

      if (event.key === "ArrowRight") {
        if (gameState === "INTRO") {
          commandForKey = "/game round";
        } else if (["QUESTION", "ANSWER_LOCKED"].includes(gameState)) {
          commandForKey = "/game reveal";
        } else if (["REVEAL", "ROUND_RESULT"].includes(gameState)) {
          commandForKey = "/game next";
        }
      }

      if (event.key === "ArrowLeft") {
        commandForKey = "/game previous";
      }

      if (event.key === "Escape") {
        commandForKey = "/game cancel";
      }

      if (!commandForKey) {
        return;
      }

      event.preventDefault();
      sendOperatorCommand(commandForKey, "GAME CONTROL ERROR");
    }

    window.addEventListener("keydown", handleGameShortcut);
    return () => window.removeEventListener("keydown", handleGameShortcut);
  }, [verdadeOuBolo?.active, verdadeOuBolo?.data?.state, verdadeOuBolo?.data?.videoCommand?.action, pending, sendOperatorCommand]);

  return (
    <Terminal title="OPERATOR" footer={footer} className={terminalClassName}>
      <div className={`${styles.operator} ${embedded ? styles.embeddedOperator : ""}`}>
        <section className={styles.console}>
          <div className={styles.meta}>
            <span className={status === "CONNECTED" ? styles.connected : styles.disconnected}>
              {status}
            </span>
            <span>MEMORIES: {state.memories.length}</span>
            <span>MESSAGES: {state.conversation.length}</span>
            <span className={styles.modeBadge}>MODE: {(state.mode || "host").toUpperCase()}</span>
            <span>INTENSITY: {(state.performance?.intensity || "calm").toUpperCase()}</span>
            <span>GAME: {game.active ? `${game.id} / ${game.startSource}`.toUpperCase() : `COOLDOWN ${game.cooldownTurnsRemaining || 0}`}</span>
            <span>SUITCASE: {suitcase.active ? `${suitcase.phase} / ${suitcase.activeExperience || "none"}` : suitcase.phase}</span>
            <span>INSTAGRAM: {instagram.status || "DISCONNECTED"}</span>
            <span>PARTICIPANTS: T{participantCounts.team} A{participantCounts.audience} S{participantCounts.session}</span>
            <span>ACTIVITIES: {activities.length}</span>
            <span>EVENTS: {state.performance?.events?.length || 0}</span>
            <label className={styles.modelControl}>
              MODEL:
              <select
                aria-label="Modelo GPT"
                className={styles.modelSelect}
                disabled={pending}
                onChange={(event) => changeModel(event.target.value)}
                value={state.model || "gpt-5-mini"}
              >
                {modelOptions.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </label>
            <span>KNOWLEDGE: {state.context?.knowledge?.loaded ? "loaded" : "not loaded"}</span>
            <span>VARIABLES: {variableCount}</span>
            <span>PROMPT VERSION: {state.context?.promptVersion || 1}</span>
          </div>

          <div className={styles.history}>
            {logs.length === 0 ? <p>SYSTEM READY</p> : null}
            {logs.map((log) => (
              <p className={styles[log.kind]} key={log.id}>{log.line}</p>
            ))}
            {pending ? <p>PROCESSING...</p> : null}
            <div ref={scrollRef} />
          </div>
        </section>

        <aside className={styles.memoryPanel}>
          <h2>MEMORY BUFFER</h2>
          {latestMemories.length === 0 ? <p>EMPTY</p> : null}
          {latestMemories.map((memory) => (
            <article className={styles.memory} key={memory.id}>
              <strong>MEMORY</strong>
              <time>{new Date(memory.timestamp).toLocaleTimeString("pt-BR")}</time>
              <p>{memory.content}</p>
            </article>
          ))}

          <h2>PERFORMANCE</h2>
          <article className={styles.memory}>
            <strong>INSTAGRAM / {instagram.status || "DISCONNECTED"}</strong>
            <p>
              ACCOUNT: @{instagram.account || "caixapretabot"}
              {"\n"}TARGET: {instagram.targetProfile ? `@${instagram.targetProfile}` : "-"}
              {"\n"}ACTION: {instagram.lastAction || "-"}
              {"\n"}BUTTON: {instagram.lastButtonState || "-"}
              {"\n"}MESSAGE: {instagram.message || "-"}
              {"\n"}URL: {instagram.currentUrl || "-"}
            </p>
            <button
              className={styles.approveButton}
              disabled={pending}
              onClick={() => sendOperatorCommand("/instagram follow cappavictor", "INSTAGRAM ERROR")}
              type="button"
            >
              FOLLOW @CAPPAVICTOR
            </button>
            <div className={styles.inlineControls}>
              <button
                className={styles.approveButton}
                disabled={pending || instagram.status === "DISCONNECTED"}
                onClick={toggleInstagramAudio}
                type="button"
              >
                {instagram.audioMuted === false ? "SOUND ON" : "SOUND OFF"}
              </button>
              <button
                className={styles.panicButton}
                onClick={() => sendOperatorCommand("/stopall", "STOPALL ERROR")}
                type="button"
              >
                STOP ALL
              </button>
            </div>
          </article>
          {instagramLogs.length ? (
            <article className={styles.memory}>
              <strong>INSTAGRAM LOG</strong>
              <p>{instagramLogs.map((entry) => `${new Date(entry.timestamp).toLocaleTimeString("pt-BR")} ${entry.status}: ${entry.message}`).join("\n")}</p>
            </article>
          ) : null}
          <article className={styles.memory}>
            <strong>SUITCASE DEBUG</strong>
            <p>
              CURRENT EXPERIENCE: {suitcase.activeExperience || "NONE"}
              {"\n"}CURRENT GAME: {suitcaseGame?.id || "NONE"}
              {"\n"}CURRENT STATE: {suitcase.phase || "IDLE"}
              {"\n"}LAST USER INPUT: {suitcase.lastUserInput || "-"}
              {"\n"}LAST BOT INTENT: {suitcase.lastBotIntent || "-"}
              {"\n"}QUESTION COUNT: {suitcase.guessWho?.questionCount ?? "-"}
              {"\n"}TIMER: {suitcase.instagram?.remainingTime ?? "-"}
              {"\n"}SELECTED PERSON: {suitcase.instagram?.selectedPerson?.name || "-"}
              {"\n"}SELECTED WORD: {suitcaseGame?.publicState?.progress || suitcaseGame?.publicState?.scrambled || suitcaseGame?.publicState?.prompt || "-"}
              {"\n"}GAME RESULT: {suitcase.result || "-"}
            </p>
          </article>
          <div className={styles.controlGrid}>
            <button disabled={pending} onClick={() => sendOperatorCommand("/mala start", "MALA ERROR")} type="button">START SUITCASES</button>
            <button disabled={pending} onClick={() => sendOperatorCommand("/mala abort", "MALA ERROR")} type="button">ABORT CURRENT GAME</button>
            <button disabled={pending} onClick={() => sendOperatorCommand("/mala reset", "MALA ERROR")} type="button">RESET GAME</button>
            <button disabled={pending} onClick={() => sendOperatorCommand("/mala 1", "MALA ERROR")} type="button">FORCE SUITCASE 1 / NAME</button>
            <button disabled={pending} onClick={() => sendOperatorCommand("/mala 2", "MALA ERROR")} type="button">FORCE SUITCASE 2 / INSTAGRAM</button>
            <button disabled={pending} onClick={() => sendOperatorCommand("/mala 3", "MALA ERROR")} type="button">FORCE SUITCASE 3 / RANDOM GAME</button>
            <button disabled={pending} onClick={() => sendOperatorCommand("/mala next", "MALA ERROR")} type="button">NEXT INSTAGRAM PERSON</button>
            <button disabled={pending} onClick={() => sendOperatorCommand("/mala win", "MALA ERROR")} type="button">FORCE WIN</button>
            <button disabled={pending} onClick={() => sendOperatorCommand("/mala lose", "MALA ERROR")} type="button">FORCE LOSE</button>
          </div>
          <article className={styles.memory}>
            <strong>GAME DIRECTOR</strong>
            <p>
              {game.id ? `${game.id} / ${game.phase} / ${game.startSource || "none"}` : "NO GAME"}
              {"\n"}AVAILABLE: {participantCounts.available}
              {"\n"}COOLDOWN: {game.cooldownTurnsRemaining || 0}
            </p>
          </article>
          {verdadeOuBolo ? (
            <VerdadeOuBoloControls
              game={verdadeOuBolo}
              pending={pending}
              sendOperatorCommand={sendOperatorCommand}
            />
          ) : null}
          {game.participants?.length ? (
            <article className={styles.memory}>
              <strong>GAME PARTICIPANTS</strong>
              <p>{game.participants.map((participant) => `${participant.name} [${participant.source}]`).join("\n")}</p>
            </article>
          ) : null}
          {game.teams?.length ? (
            <article className={styles.memory}>
              <strong>TEAMS</strong>
              <p>{game.teams.map((team) => `${team.name}: ${team.participants.map((participant) => participant.name).join(", ")}`).join("\n")}</p>
            </article>
          ) : null}
          {participantHistory.length ? (
            <article className={styles.memory}>
              <strong>MOST USED</strong>
              <p>{participantHistory.map((participant) => `${participant.name} ${participant.selectedCount}`).join("\n")}</p>
            </article>
          ) : null}
          <button
            className={styles.panicButton}
            onClick={() => sendOperatorCommand("/phone hide", "PHONE ERROR")}
            type="button"
          >
            HIDE PHONE
          </button>
          {phoneProjection.status !== "hidden" ? (
            <article className={styles.memory}>
              <strong>PHONE / {phoneProjection.status}</strong>
              <p>{[phoneProjection.participant, phoneProjection.contentType, phoneProjection.privacyLevel].filter(Boolean).join(" / ") || "PENDING"}</p>
              {phoneProjection.status === "pending_operator_confirmation" ? (
                <button
                  className={styles.approveButton}
                  disabled={pending}
                  onClick={() => sendOperatorCommand("/phone approve", "PHONE ERROR")}
                  type="button"
                >
                  APPROVE PHONE
                </button>
              ) : null}
            </article>
          ) : null}
          {activities.length === 0 ? <p>NO ACTIVE ACTIVITIES</p> : null}
          {activities.map((activity) => (
            <article className={styles.memory} key={activity.id}>
              <strong>{activity.type} / {activity.status}</strong>
              <p>{JSON.stringify(activity.publicState)}</p>
            </article>
          ))}

          <h2>EVENT LOG</h2>
          {performanceLog.length === 0 ? <p>EMPTY</p> : null}
          {performanceLog.map((entry) => (
            <article className={styles.memory} key={entry.id}>
              <strong>{entry.type}</strong>
              <time>{new Date(entry.timestamp).toLocaleTimeString("pt-BR")}</time>
              <p>{[entry.eventType, entry.activityType, entry.action, entry.text].filter(Boolean).join(" / ") || entry.eventId || "LOG"}</p>
            </article>
          ))}
        </aside>
      </div>
    </Terminal>
  );
}

function VerdadeOuBoloControls({ game, pending, sendOperatorCommand }) {
  const data = game.data || {};
  const operator = data.operator || {};
  const round = data.currentRound || {};
  const result = data.result || null;
  const video = round.video || {};
  const voteCountdown = data.voteCountdown || null;
  const votingSeconds = voteCountdown
    ? Math.max(0, Math.ceil((Number(voteCountdown.endsAt || 0) - Date.now()) / 1000))
    : null;

  return (
    <>
      <article className={styles.memory}>
        <strong>VERDADE OU BOLO / CONTROLS</strong>
        <p>
          STATE: {data.state || game.phase || "-"}
          {"\n"}ROUND: {round.number || 1}/{round.total || data.totalRounds || 4}
          {"\n"}VIDEO: {video.file || "AUSENTE"}
          {"\n"}ANSWER: {data.selectedAnswer || "null"}
          {"\n"}REVEAL ARMED: {data.revealArmed ? "YES" : "NO"}
          {"\n"}VOTE COUNTDOWN: {votingSeconds ?? "-"}
          {"\n"}CORRECT: {operator.correctAnswer || "CONFIGURE"}
          {"\n"}SCORE: {data.score || 0}
        </p>
        {!video.src ? (
          <p className={styles.error}>VIDEO AUSENTE EM assets/videos/verdade-ou-bolo/</p>
        ) : null}
      </article>

      <div className={styles.vobControls}>
        <button disabled={pending} onClick={() => sendOperatorCommand("/game intro", "GAME CONTROL ERROR")} type="button">INICIAR INTRO</button>
        <button disabled={pending} onClick={() => sendOperatorCommand("/game round", "GAME CONTROL ERROR")} type="button">INICIAR RODADA</button>
        <button disabled={pending} onClick={() => sendOperatorCommand("/game play", "GAME CONTROL ERROR")} type="button">PLAY VIDEO</button>
        <button disabled={pending} onClick={() => sendOperatorCommand("/game pause", "GAME CONTROL ERROR")} type="button">PAUSE VIDEO</button>
        <button disabled={pending} onClick={() => sendOperatorCommand("/game restart", "GAME CONTROL ERROR")} type="button">RESTART VIDEO</button>
        <button
          className={data.selectedAnswer === "verdade" ? styles.vobSelected : ""}
          disabled={pending || !["QUESTION", "ANSWER_LOCKED", "VOTING"].includes(data.state)}
          onClick={() => sendOperatorCommand("/game verdade", "GAME CONTROL ERROR")}
          type="button"
        >
          VERDADE
        </button>
        <button
          className={data.selectedAnswer === "bolo" ? styles.vobSelected : ""}
          disabled={pending || !["QUESTION", "ANSWER_LOCKED", "VOTING"].includes(data.state)}
          onClick={() => sendOperatorCommand("/game bolo", "GAME CONTROL ERROR")}
          type="button"
        >
          BOLO
        </button>
        <button
          className={styles.vobRevealButton}
          disabled={pending || !["QUESTION", "ANSWER_LOCKED", "REVEAL", "ROUND_RESULT"].includes(data.state)}
          onClick={() => sendOperatorCommand("/game reveal", "GAME CONTROL ERROR")}
          type="button"
        >
          REVELAR RESPOSTA
        </button>
        <button
          disabled={pending || data.revealArmed || Boolean(voteCountdown) || !["INTRO", "REVEAL", "ROUND_RESULT"].includes(data.state)}
          onClick={() => sendOperatorCommand("/game next", "GAME CONTROL ERROR")}
          type="button"
        >
          PROXIMA
        </button>
        <button disabled={pending} onClick={() => sendOperatorCommand("/game previous", "GAME CONTROL ERROR")} type="button">{"<- RODADA ANTERIOR"}</button>
        <button disabled={pending} onClick={() => sendOperatorCommand("/game nextround", "GAME CONTROL ERROR")} type="button">{"-> PROXIMA RODADA"}</button>
        <button
          className={styles.panicButton}
          disabled={pending}
          onClick={() => sendOperatorCommand("/game finish", "GAME CONTROL ERROR")}
          type="button"
        >
          ENCERRAR GAME SHOW
        </button>
        <button
          className={styles.panicButton}
          disabled={pending}
          onClick={() => sendOperatorCommand("/game cancel", "GAME CONTROL ERROR")}
          type="button"
        >
          CANCELAR
        </button>
      </div>

      {result ? (
        <article className={styles.memory}>
          <strong>ROUND RESULT</strong>
          <p>
            ROUND {result.round}: {result.selected} / CORRECT {result.correct}
            {"\n"}{result.noVote ? "SEM VOTO / ERRARAM" : result.won ? "ACERTARAM" : "ERRARAM"}
          </p>
        </article>
      ) : null}
    </>
  );
}
