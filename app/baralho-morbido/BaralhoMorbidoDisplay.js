"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DisplayBlackout from "@/components/DisplayBlackout";
import styles from "./BaralhoMorbidoDisplay.module.css";

const INITIAL_STATE = {
  phase: "IDLE",
  drawSequence: 0,
  totalCards: 0,
  cards: [],
  usedIds: [],
  remainingIds: [],
  currentCard: null,
  currentVideo: null,
  displayConnections: 0
};

function phaseClass(phase) {
  return styles[`phase${phase}`] || "";
}

function formatCounter(value, total) {
  return `${`${value}`.padStart(2, "0")} / ${`${total}`.padStart(2, "0")}`;
}

function CardBack({ className = "", index = 0, compact = false }) {
  return (
    <div
      className={`${styles.cardBack} ${compact ? styles.compactCard : ""} ${className}`}
      style={{ "--card-index": index }}
    >
      <div className={styles.cardInnerBorder}>
        <div className={styles.cornerMark}>BM</div>
        <div className={styles.cardSigil} aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}

function MissingVideo({ card }) {
  return (
    <div className={styles.missingVideo}>
      <span>CARTA {card?.id || "--"}</span>
      <strong>VIDEO AUSENTE</strong>
      <small>assets/videos/baralho-morbido/{card?.video?.file || "00.mp4"}</small>
    </div>
  );
}

function CardVideo({ card, expanded = false, shouldPlay = false }) {
  const videoRef = useRef(null);
  const playStartedRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const src = card?.video?.src || "";

  useEffect(() => {
    playStartedRef.current = false;
    setFailed(false);
    setLoaded(false);
  }, [src]);

  useEffect(() => {
    if (!src) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        setFailed(true);
      }
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !src || failed || !shouldPlay) {
      video?.pause();
      return undefined;
    }

    let firstFrameId = 0;
    let layoutFrameId = 0;

    function playAfterLayout() {
      if (playStartedRef.current) {
        return;
      }

      video.pause();
      video.currentTime = 0;
      firstFrameId = window.requestAnimationFrame(() => {
        layoutFrameId = window.requestAnimationFrame(() => {
          playStartedRef.current = true;
          video.muted = false;
          const playAttempt = video.play();

          if (!playAttempt?.catch) {
            return;
          }

          playAttempt.catch(() => {
            video.muted = true;
            video.play().catch(() => {});
          });
        });
      });
    }

    if (video.readyState >= 2) {
      playAfterLayout();
    } else {
      video.addEventListener("loadeddata", playAfterLayout, { once: true });
    }

    return () => {
      video.removeEventListener("loadeddata", playAfterLayout);
      window.cancelAnimationFrame(firstFrameId);
      window.cancelAnimationFrame(layoutFrameId);
      video.pause();
    };
  }, [failed, shouldPlay, src]);

  if (!src || failed) {
    return <MissingVideo card={card} />;
  }

  return (
    <div className={`${styles.videoFace} ${expanded ? styles.videoFaceExpanded : ""}`}>
      <video
        className={styles.video}
        controls={false}
        data-playback={shouldPlay ? "playing" : "preview"}
        key={src}
        loop
        onCanPlay={() => setLoaded(true)}
        onError={() => setFailed(true)}
        onLoadedData={() => setLoaded(true)}
        playsInline
        preload="auto"
        ref={videoRef}
        src={src}
      />
      {!loaded ? <div className={styles.videoLoading}>CARREGANDO CARTA {card.id}</div> : null}
      <span className={styles.cardLabel}>CARTA {card.id}</span>
    </div>
  );
}

function IdleDeck({ cards }) {
  const deckCards = cards.length ? cards : [{ id: "empty" }];

  return (
    <div className={styles.idleDeck} aria-hidden="true">
      {deckCards.slice(0, 10).map((card, index) => (
        <CardBack className={styles.idleDeckCard} compact index={index} key={card.id} />
      ))}
    </div>
  );
}

function ShuffleDeck({ cards, sequence }) {
  return (
    <div className={styles.shuffleDeck} key={`shuffle-${sequence}`} aria-hidden="true">
      {Array.from({ length: Math.max(1, cards.length) }, (_, index) => (
        <CardBack className={styles.shuffleCard} compact index={index} key={index} />
      ))}
    </div>
  );
}

function SelectedCard({ phase, card }) {
  const revealing = phase === "REVEALING";

  return (
    <div className={`${styles.selectedCardWrap} ${revealing ? styles.revealingCardWrap : ""}`}>
      <div className={`${styles.flipCard} ${revealing ? styles.flipCardRevealing : ""}`}>
        <div className={`${styles.flipFace} ${styles.flipBack}`}>
          <CardBack />
        </div>
        <div className={`${styles.flipFace} ${styles.flipFront}`}>
          <CardVideo card={card} />
        </div>
      </div>
      {!revealing ? <div className={styles.winnerPulse}>WINNER SELECTED</div> : null}
    </div>
  );
}

export default function BaralhoMorbidoDisplay() {
  const [deck, setDeck] = useState(INITIAL_STATE);
  const [displayBlackout, setDisplayBlackout] = useState(null);
  const [connection, setConnection] = useState("CONNECTING");
  const [cursorHidden, setCursorHidden] = useState(false);
  const cursorTimerRef = useRef(null);

  useEffect(() => {
    let active = true;
    let refreshing = false;

    async function refreshDeck(refreshAssets = false) {
      if (refreshing) {
        return;
      }

      refreshing = true;

      try {
        const url = refreshAssets ? "/api/baralho-morbido?refresh=1" : "/api/baralho-morbido";
        const response = await fetch(url, { cache: "no-store" });
        const data = await response.json();

        if (!active) {
          return;
        }

        setDeck(data || INITIAL_STATE);
        setDisplayBlackout(data?.displayBlackout || null);
        setConnection("CONNECTED");
      } catch {
        if (active) {
          setConnection("DISCONNECTED");
        }
      } finally {
        refreshing = false;
      }
    }

    fetch("/api/baralho-morbido", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "display-connect" })
    }).catch(() => {});

    refreshDeck(true);
    const timer = window.setInterval(refreshDeck, 400);

    return () => {
      active = false;
      window.clearInterval(timer);

      const body = JSON.stringify({ action: "display-disconnect" });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/baralho-morbido", new Blob([body], { type: "application/json" }));
        return;
      }

      fetch("/api/baralho-morbido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true
      }).catch(() => {});
    };
  }, []);

  useEffect(() => {
    function showCursor() {
      setCursorHidden(false);
      window.clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = window.setTimeout(() => setCursorHidden(true), 2200);
    }

    showCursor();
    window.addEventListener("mousemove", showCursor);
    window.addEventListener("keydown", showCursor);

    return () => {
      window.clearTimeout(cursorTimerRef.current);
      window.removeEventListener("mousemove", showCursor);
      window.removeEventListener("keydown", showCursor);
    };
  }, []);

  const revealedCount = deck.usedIds?.length || 0;
  const totalCards = deck.totalCards ?? 0;
  const currentCard = deck.currentCard;
  const showIdle = deck.phase === "IDLE" || !currentCard;
  const showShuffle = deck.phase === "SHUFFLING";
  const showSelection = deck.phase === "SELECTING" || deck.phase === "REVEALING";
  const showVideo = ["PLAYING", "FINISHED"].includes(deck.phase) && currentCard;
  const jackpotText = useMemo(() => {
    if (deck.phase === "FINISHED") {
      return "TODAS AS CARTAS FORAM REVELADAS";
    }

    if (deck.phase === "PLAYING") {
      return "RECOMPENSA EM LOOP";
    }

    if (deck.phase === "SHUFFLING") {
      return "RODADA EM ANDAMENTO";
    }

    if (deck.phase === "SELECTING" || deck.phase === "REVEALING") {
      return "PREMIO SELECIONADO";
    }

    return "PROXIMA RODADA";
  }, [deck.phase]);

  return (
    <main className={`${styles.screen} ${phaseClass(deck.phase)} ${cursorHidden ? styles.cursorHidden : ""}`}>
      <DisplayBlackout blackout={displayBlackout} target="baralho" />
      <div className={styles.lightGrid} aria-hidden="true" />
      <div className={styles.sparkRail} aria-hidden="true" />

      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>JACKPOT SINISTRO</span>
        </div>
        <div className={styles.counter}>
          <span>{jackpotText}</span>
          <strong>{formatCounter(revealedCount, totalCards)}</strong>
        </div>
      </header>

      <section className={styles.stage} aria-live="polite">
        {showIdle ? <IdleDeck cards={deck.cards || []} /> : null}
        {showShuffle ? <ShuffleDeck cards={deck.cards || []} sequence={deck.drawSequence} /> : null}
        {showSelection ? <SelectedCard card={currentCard} phase={deck.phase} /> : null}
        {showVideo ? (
          <div className={styles.expandedVideoCard}>
            <CardVideo card={currentCard} expanded shouldPlay />
          </div>
        ) : null}
      </section>

      <footer className={styles.footer}>
        <span>BET LIMIT: MEMORIA</span>
        <span>ODDS: {deck.remainingIds?.length || 0} RESTANTES</span>
        <span>{connection}</span>
      </footer>
    </main>
  );
}
