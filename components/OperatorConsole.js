"use client";

import { useEffect, useRef, useState } from "react";
import Terminal from "./Terminal";
import styles from "./OperatorConsole.module.css";

export default function OperatorConsole() {
  const [command, setCommand] = useState("");
  const [logs, setLogs] = useState([]);
  const [state, setState] = useState({ memories: [], conversation: [], variables: {} });
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
      setState(payload.state);
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
    if (!["/memory", "/say"].includes(commandName)) {
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

  const latestMemories = state.memories.slice(-5).reverse();
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
    <Terminal title="CAIXA PRETA / OPERATOR" footer={footer}>
      <div className={styles.operator}>
        <section className={styles.console}>
          <div className={styles.meta}>
            <span className={status === "CONNECTED" ? styles.connected : styles.disconnected}>
              {status}
            </span>
            <span>MEMORIES: {state.memories.length}</span>
            <span>MESSAGES: {state.conversation.length}</span>
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
        </aside>
      </div>
    </Terminal>
  );
}
