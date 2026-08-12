"use client";

import { useEffect, useRef, useState } from "react";
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

  function addLog(line, kind = "line") {
    setLogs((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        kind,
        line
      }
    ]);
  }

  async function submitCommand(event) {
    event.preventDefault();

    const raw = command.trim();
    if (!raw || pending) {
      return;
    }

    setCommand("");
    addLog(`> ${raw}`, "input");

    if (!raw.startsWith("/")) {
      addLog("COMMAND REQUIRED", "error");
      return;
    }

    const commandName = raw.split(/\s+/)[0];
    if (![
      "/memory",
      "/say",
      "/reset",
      "/malas",
      "/mala",
      "/event",
      "/draw",
      "/game",
      "/activity",
      "/intensity",
      "/model",
      "/phone",
      "/clear",
      "/clear-performance"
    ].includes(commandName)) {
      addLog(`UNKNOWN COMMAND: ${commandName}`, "error");
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: raw })
      });
      const data = await response.json();

      if (!response.ok) {
        addLog(data.error || "OPERATOR ERROR", "error");
        return;
      }

      addLog(data.message, "ok");
    } catch {
      addLog("SERVER CONNECTION FAILED", "error");
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
      const response = await fetch("/api/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: `/model ${model}` })
      });
      const data = await response.json();

      if (!response.ok) {
        addLog(data.error || "MODEL ERROR", "error");
        return;
      }

      addLog(data.message, "ok");
    } catch {
      addLog("SERVER CONNECTION FAILED", "error");
    } finally {
      setPending(false);
    }
  }

  async function sendOperatorCommand(raw, fallback = "OPERATOR ERROR") {
    addLog(`> ${raw}`, "input");
    setPending(true);

    try {
      const response = await fetch("/api/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: raw })
      });
      const data = await response.json();

      if (!response.ok) {
        addLog(data.error || fallback, "error");
        return;
      }

      addLog(data.message, "ok");
    } catch {
      addLog("SERVER CONNECTION FAILED", "error");
    } finally {
      setPending(false);
    }
  }

  const latestMemories = state.memories.slice(-5).reverse();
  const performanceLog = (state.performance?.eventLog || []).slice(-8).reverse();
  const activities = state.performance?.activities || [];
  const phoneProjection = state.performance?.phoneProjection || { status: "hidden" };
  const game = state.game || { active: false, id: null, cooldownTurnsRemaining: 0 };
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
        disabled={pending}
      />
    </form>
  );

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
            <strong>GAME DIRECTOR</strong>
            <p>
              {game.id ? `${game.id} / ${game.phase} / ${game.startSource || "none"}` : "NO GAME"}
              {"\n"}AVAILABLE: {participantCounts.available}
              {"\n"}COOLDOWN: {game.cooldownTurnsRemaining || 0}
            </p>
          </article>
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
