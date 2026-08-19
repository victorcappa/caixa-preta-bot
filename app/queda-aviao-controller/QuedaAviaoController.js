"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_FADE_MS,
  scriptLines,
  subdivisionOptions
} from "../queda-aviao/script";
import styles from "./QuedaAviaoController.module.css";

const INITIAL_STATE = {
  rawText: scriptLines.join("\n"),
  subdivision: "line",
  fadeMs: DEFAULT_FADE_MS,
  pace: 1,
  stageMultiplier: 1,
  autoPlay: false,
  loop: true,
  currentIndex: 0,
  phase: "visible",
  segments: [],
  currentSegment: null,
  displayConnections: 0
};

function clampIndex(index, length) {
  if (length <= 0) {
    return 0;
  }

  return Math.min(Math.max(Number(index) || 0, 0), length - 1);
}

async function postQuedaAviaoAction(action, payload = {}) {
  const response = await fetch("/api/queda-aviao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload })
  });
  const data = await response.json();
  return { response, data };
}

export default function QuedaAviaoController() {
  const [playback, setPlayback] = useState(INITIAL_STATE);
  const [connection, setConnection] = useState("CONNECTING");
  const [pending, setPending] = useState(false);
  const [log, setLog] = useState("SYSTEM READY");

  useEffect(() => {
    fetch("/api/queda-aviao")
      .then((response) => response.json())
      .then((data) => setPlayback(data || INITIAL_STATE))
      .catch(() => setConnection("DISCONNECTED"));

    const events = new EventSource("/api/events?client=queda-aviao-controller");
    events.onopen = () => setConnection("CONNECTED");
    events.onerror = () => setConnection("DISCONNECTED");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setPlayback(payload.state?.quedaAviao || INITIAL_STATE);
    };

    return () => events.close();
  }, []);

  const segments = playback.segments || [];
  const currentIndex = clampIndex(playback.currentIndex, segments.length);
  const current = playback.currentSegment || segments[currentIndex];
  const displayConnected = (playback.displayConnections || 0) > 0;
  const statusLabel = playback.autoPlay ? "AUTOMATICO" : "MANUAL";

  async function runAction(action, payload = {}, message = action.toUpperCase(), { allowWhilePending = false } = {}) {
    if (pending && !allowWhilePending) {
      return;
    }

    if (!allowWhilePending) {
      setPending(true);
    }
    setLog(`> ${message}`);

    try {
      const { response, data } = await postQuedaAviaoAction(action, payload);

      if (!response.ok) {
        setLog(data.error || "QUEDA AVIAO ERROR");
        return;
      }

      setPlayback(data.state || INITIAL_STATE);
      setLog(data.message || "QUEDA AVIAO UPDATED");
    } catch {
      setLog("SERVER CONNECTION FAILED");
    } finally {
      if (!allowWhilePending) {
        setPending(false);
      }
    }
  }

  function updatePlayback(payload) {
    setPlayback((state) => ({ ...state, ...payload }));
    runAction("update", payload, "ATUALIZAR CONTROLE", { allowWhilePending: true });
  }

  return (
    <main className={styles.controllerScreen}>
      <section className={styles.preview} aria-live="polite">
        {current ? (
          <p
            key={`${current.id}-${playback.playbackSequence || 0}`}
            className={[
              styles.line,
              current.stage ? styles.stage : styles.dialogue,
              styles[playback.phase]
            ].join(" ")}
            style={{ "--fade-ms": `${playback.fadeMs}ms` }}
          >
            {current.text}
          </p>
        ) : null}
      </section>

      <aside className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <span>CONTROLLER PRIVADO</span>
            <h1>QUEDA AVIÃO</h1>
          </div>
          <strong className={connection === "CONNECTED" ? styles.connected : styles.disconnected}>
            {connection}
          </strong>
        </header>

        <section className={styles.statusGrid} aria-label="Estado atual">
          <article>
            <span>MODO</span>
            <strong>{statusLabel}</strong>
          </article>
          <article>
            <span>SEGMENTO</span>
            <strong>{segments.length ? `${currentIndex + 1}/${segments.length}` : "0/0"}</strong>
          </article>
          <article>
            <span>TELA PUBLICA</span>
            <strong className={displayConnected ? styles.connectedText : styles.warningText}>
              {displayConnected ? `${playback.displayConnections} CONECTADA` : "DESCONECTADA"}
            </strong>
          </article>
        </section>

        <div className={styles.transport}>
          <button disabled={pending} type="button" onClick={() => runAction("set-index", { index: 0 }, "INICIO")}>
            INÍCIO
          </button>
          <button disabled={pending} type="button" onClick={() => runAction("previous", {}, "ANTERIOR")}>
            ANTERIOR
          </button>
          <button
            disabled={pending}
            type="button"
            className={styles.primaryButton}
            onClick={() => runAction(playback.autoPlay ? "pause" : "play", {}, playback.autoPlay ? "PAUSAR" : "TOCAR")}
          >
            {playback.autoPlay ? "PAUSAR" : "TOCAR"}
          </button>
          <button disabled={pending} type="button" onClick={() => runAction("next", {}, "PROXIMA")}>
            PRÓXIMA
          </button>
        </div>

        <label className={styles.field}>
          <span>FALA / SEGMENTO</span>
          <input
            min="1"
            max={Math.max(segments.length, 1)}
            onChange={(event) => runAction("set-index", { index: Number(event.target.value) - 1 }, "IR PARA SEGMENTO")}
            type="number"
            value={segments.length ? currentIndex + 1 : 0}
          />
        </label>

        <label className={styles.field}>
          <span>SUBDIVISÃO</span>
          <select
            value={playback.subdivision}
            onChange={(event) => updatePlayback({ subdivision: event.target.value, currentIndex: 0 })}
          >
            {subdivisionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>FADE: {playback.fadeMs}MS</span>
          <input
            max="3000"
            min="0"
            onChange={(event) => updatePlayback({ fadeMs: Number(event.target.value) })}
            step="50"
            type="range"
            value={playback.fadeMs}
          />
        </label>

        <div className={styles.inlineActions}>
          <button disabled={pending} type="button" onClick={() => updatePlayback({ fadeMs: 0 })}>SEM FADE</button>
          <button disabled={pending} type="button" onClick={() => updatePlayback({ fadeMs: DEFAULT_FADE_MS })}>
            FADE PADRÃO
          </button>
        </div>

        <label className={styles.field}>
          <span>RITMO GERAL: {Number(playback.pace).toFixed(2)}X</span>
          <input
            max="2"
            min="0.35"
            onChange={(event) => updatePlayback({ pace: Number(event.target.value) })}
            step="0.05"
            type="range"
            value={playback.pace}
          />
        </label>

        <label className={styles.field}>
          <span>TEMPO DAS RUBRICAS: {Number(playback.stageMultiplier).toFixed(2)}X</span>
          <input
            max="2.5"
            min="0.5"
            onChange={(event) => updatePlayback({ stageMultiplier: Number(event.target.value) })}
            step="0.05"
            type="range"
            value={playback.stageMultiplier}
          />
        </label>

        <label className={styles.checkbox}>
          <input checked={playback.loop} onChange={(event) => updatePlayback({ loop: event.target.checked })} type="checkbox" />
          <span>LOOP</span>
        </label>

        <div className={styles.segmentList}>
          {segments.map((segment, index) => (
            <button
              className={[
                styles.segmentButton,
                index === currentIndex ? styles.currentSegment : "",
                segment.stage ? styles.stageSegment : ""
              ].join(" ")}
              key={segment.id}
              onClick={() => runAction("set-index", { index }, `SEGMENTO ${index + 1}`)}
              type="button"
            >
              <span>{index + 1}</span>
              <span>{segment.text}</span>
            </button>
          ))}
        </div>

        <label className={styles.textEditor}>
          <span>TEXTO BASE</span>
          <textarea
            value={playback.rawText || INITIAL_STATE.rawText}
            onChange={(event) => updatePlayback({ rawText: event.target.value, currentIndex: 0 })}
          />
        </label>

        <section className={styles.debug}>
          <h2>Debug</h2>
          <pre>
{[
  `conexao_controller: ${connection}`,
  `conexao_tela_publica: ${displayConnected ? "CONNECTED" : "DISCONNECTED"}`,
  `display_connections: ${playback.displayConnections || 0}`,
  `auto_play: ${playback.autoPlay ? "true" : "false"}`,
  `phase: ${playback.phase}`,
  `fade_ms: ${playback.fadeMs}`,
  `pace: ${playback.pace}`,
  `stage_multiplier: ${playback.stageMultiplier}`,
  `subdivision: ${playback.subdivision}`,
  `playback_sequence: ${playback.playbackSequence || 0}`,
  `last_event: ${playback.lastEvent?.type || "-"}`
].join("\n")}
          </pre>
          <p className={styles.log}>{log}</p>
        </section>

        <button className={styles.resetButton} disabled={pending} onClick={() => runAction("reset", {}, "RESETAR")} type="button">
          RESETAR QUEDA AVIÃO
        </button>
      </aside>
    </main>
  );
}
