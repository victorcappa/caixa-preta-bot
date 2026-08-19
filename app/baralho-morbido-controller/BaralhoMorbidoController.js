"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./BaralhoMorbidoController.module.css";

const INITIAL_STATE = {
  phase: "IDLE",
  drawSequence: 0,
  totalCards: 10,
  usedIds: [],
  remainingIds: [],
  currentCard: null,
  currentVideo: null,
  displayConnections: 0
};

const STATUS_LABELS = {
  IDLE: "AGUARDANDO",
  SHUFFLING: "EMBARALHANDO",
  SELECTING: "REVELANDO",
  REVEALING: "REVELANDO",
  PLAYING: "REPRODUZINDO",
  FINISHED: "FINALIZADO"
};

const BUSY_PHASES = new Set(["SHUFFLING", "SELECTING", "REVEALING"]);

function formatIds(ids) {
  return ids?.length ? ids.join(", ") : "-";
}

async function postBaralhoAction(action) {
  const response = await fetch("/api/baralho-morbido", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action })
  });
  const data = await response.json();
  return { response, data };
}

export default function BaralhoMorbidoController() {
  const [deck, setDeck] = useState(INITIAL_STATE);
  const [connection, setConnection] = useState("CONNECTING");
  const [pending, setPending] = useState(false);
  const [log, setLog] = useState("SYSTEM READY");

  useEffect(() => {
    fetch("/api/baralho-morbido")
      .then((response) => response.json())
      .then((data) => setDeck(data || INITIAL_STATE))
      .catch(() => setConnection("DISCONNECTED"));

    const events = new EventSource("/api/events?client=baralho-morbido-controller");
    events.onopen = () => setConnection("CONNECTED");
    events.onerror = () => setConnection("DISCONNECTED");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setDeck(payload.state?.baralhoMorbido || INITIAL_STATE);
    };

    return () => events.close();
  }, []);

  const statusLabel = STATUS_LABELS[deck.phase] || deck.phase || "AGUARDANDO";
  const usedCount = deck.usedIds?.length || 0;
  const totalCards = deck.totalCards || 10;
  const allRevealed = deck.phase === "FINISHED" || usedCount >= totalCards;
  const busy = BUSY_PHASES.has(deck.phase);
  const drawDisabled = pending || busy || allRevealed;
  const displayConnected = (deck.displayConnections || 0) > 0;
  const primaryLabel = usedCount > 0 ? "SORTEAR PROXIMA" : "EMBARALHAR / SORTEAR PROXIMA";
  const sortedCards = useMemo(() => {
    const cards = deck.cards?.length
      ? deck.cards
      : Array.from({ length: totalCards }, (_, index) => ({ id: `${index + 1}`.padStart(2, "0") }));

    return [...cards].sort((a, b) => a.id.localeCompare(b.id));
  }, [deck.cards, totalCards]);

  async function drawNext() {
    if (drawDisabled) {
      return;
    }

    setPending(true);
    setLog("> EMBARALHAR / SORTEAR PROXIMA");

    try {
      const { response, data } = await postBaralhoAction("draw");

      if (!response.ok) {
        setLog(data.error || "BARALHO ERROR");
        return;
      }

      setLog(data.message || "CARTA SORTEADA");
    } catch {
      setLog("SERVER CONNECTION FAILED");
    } finally {
      setPending(false);
    }
  }

  async function resetDeck() {
    if (pending) {
      return;
    }

    const confirmed = window.confirm("Resetar o Baralho Morbido e devolver as 10 cartas ao pool?");

    if (!confirmed) {
      return;
    }

    setPending(true);
    setLog("> RESETAR BARALHO");

    try {
      const { response, data } = await postBaralhoAction("reset");

      if (!response.ok) {
        setLog(data.error || "RESET ERROR");
        return;
      }

      setLog(data.message || "BARALHO RESETADO");
    } catch {
      setLog("SERVER CONNECTION FAILED");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className={styles.screen}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <div>
            <span>CONTROLLER PRIVADO</span>
            <h1>BARALHO MÓRBIDO — CONTROLLER</h1>
          </div>
          <strong className={connection === "CONNECTED" ? styles.connected : styles.disconnected}>{connection}</strong>
        </header>

        <section className={styles.statusGrid} aria-label="Estado atual">
          <article>
            <span>ESTADO ATUAL</span>
            <strong>{statusLabel}</strong>
          </article>
          <article>
            <span>CARTAS UTILIZADAS</span>
            <strong>{usedCount} / {totalCards}</strong>
          </article>
          <article>
            <span>TELA PUBLICA</span>
            <strong className={displayConnected ? styles.connectedText : styles.warningText}>
              {displayConnected ? `${deck.displayConnections} CONECTADA` : "DESCONECTADA"}
            </strong>
          </article>
        </section>

        {allRevealed ? (
          <div className={styles.finishedBanner}>TODAS AS CARTAS FORAM REVELADAS</div>
        ) : null}

        <button className={styles.primaryButton} disabled={drawDisabled} onClick={drawNext} type="button">
          {busy ? "ANIMACAO EM ANDAMENTO" : primaryLabel}
        </button>

        <section className={styles.usedPanel}>
          <h2>Sorteadas</h2>
          <p>{formatIds(deck.usedIds)}</p>
          <div className={styles.cardGrid}>
            {sortedCards.map((card) => {
              const used = deck.usedIds?.includes(card.id);
              const current = deck.currentCard?.id === card.id;

              return (
                <span
                  className={`${used ? styles.usedCard : ""} ${current ? styles.currentCard : ""}`}
                  key={card.id}
                >
                  {card.id}
                </span>
              );
            })}
          </div>
        </section>

        <section className={styles.debug}>
          <h2>Debug</h2>
          <pre>
{[
  `conexao_controller: ${connection}`,
  `conexao_tela_publica: ${displayConnected ? "CONNECTED" : "DISCONNECTED"}`,
  `display_connections: ${deck.displayConnections || 0}`,
  `phase: ${deck.phase}`,
  `draw_sequence: ${deck.drawSequence}`,
  `carta_atual: ${deck.currentCard?.id || "-"}`,
  `video_atual: ${deck.currentVideo?.file || "-"}`,
  `restantes: ${formatIds(deck.remainingIds)}`,
  `utilizadas: ${formatIds(deck.usedIds)}`,
  `last_event: ${deck.lastEvent?.type || "-"}`
].join("\n")}
          </pre>
          <p className={styles.log}>{log}</p>
        </section>
      </section>

      <aside className={styles.resetZone}>
        <button className={styles.resetButton} disabled={pending} onClick={resetDeck} type="button">
          RESETAR BARALHO
        </button>
      </aside>
    </main>
  );
}
