"use client";

import { useEffect, useRef, useState } from "react";
import useCountdownSound from "./useCountdownSound";
import styles from "./SceneZeroProjectionLayer.module.css";

const AIRPORT_VIDEO = "/api/game-assets?file=videos%2Fglitch%2Fpainel-aeroporto.mp4";
const TEA_FOR_TWO_AUDIO = "/api/game-assets?file=audios%2FDoris%20Day%20-%20Tea%20For%20Two%20(1950).mp3";

function timerSeconds(timer, now) {
  if (timer?.status === "running" && timer.endsAt) {
    return Math.max(0, Math.ceil((Date.parse(timer.endsAt) - now) / 1000));
  }
  if (timer?.status === "complete") return 0;
  return timer?.remainingSeconds ?? timer?.durationSeconds ?? 15;
}

function countdownSeconds(endsAt, now) {
  return endsAt ? Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 1000)) : 10;
}

export default function SceneZeroProjectionLayer({ sceneZero }) {
  const [now, setNow] = useState(Date.now());
  const audioRef = useRef(null);
  const tea = sceneZero?.teaForTwo;
  const timer = sceneZero?.timer;
  const collectionTimer = sceneZero?.collection?.activeCountdown;
  const gincana = sceneZero?.suitcaseGame?.gincana;
  const gincanaTimer = gincana?.timer;
  const participantSelection = sceneZero?.participantSelection || {};

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (tea?.status !== "playing") {
      audio.pause();
      audio.currentTime = 0;
      return;
    }

    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, [tea?.sequence, tea?.status]);

  const visibleTimer = sceneZero?.suitcaseGame?.currentSuitcase === 2 && ["running", "paused", "complete", "completed", "failed"].includes(gincanaTimer?.status)
    ? gincanaTimer
    : sceneZero?.stage === "collection" && ["running", "complete"].includes(collectionTimer?.status)
      ? collectionTimer
      : sceneZero?.stage === "singing" ? timer : null;
  const showTimer = ["running", "paused", "complete", "completed", "failed"].includes(visibleTimer?.status);
  const seconds = timerSeconds(visibleTimer, now);
  const airport = sceneZero?.stage === "airport" || sceneZero?.airportActive;
  const collapse = sceneZero?.stage === "collapse";
  const selectionCandidates = participantSelection.candidates || [];
  const rouletteElapsed = Math.max(0, now - Date.parse(participantSelection.rouletteStartedAt || now));
  const rouletteIndex = selectionCandidates.length
    ? Math.floor(rouletteElapsed / Math.max(70, 260 - Math.min(190, rouletteElapsed / 28))) % selectionCandidates.length
    : 0;
  const rouletteName = selectionCandidates[rouletteIndex]?.name || "—";
  const showParticipantSelection = ["countdown", "roulette", "selected"].includes(participantSelection.status);
  const participantSeconds = participantSelection.status === "countdown"
    ? countdownSeconds(participantSelection.countdownEndsAt, now)
    : null;

  useCountdownSound(seconds, {
    active: Boolean(showTimer && ["running", "complete"].includes(visibleTimer?.status)),
    countdownKey: `scene-zero:${visibleTimer === gincanaTimer ? "gincana" : visibleTimer === collectionTimer ? "collection" : "singing"}:${visibleTimer?.sequence || 0}`
  });
  useCountdownSound(participantSeconds, {
    active: participantSelection.status === "countdown",
    countdownKey: `scene-zero:participant:${participantSelection.sequence || 0}`
  });

  return (
    <>
      <audio preload="auto" ref={audioRef} src={TEA_FOR_TWO_AUDIO} />
      {collapse ? (
        <div className={styles.airportContamination} aria-hidden="true">
          <video autoPlay loop muted playsInline src={AIRPORT_VIDEO} />
        </div>
      ) : null}
      {airport ? (
        <div className={styles.airport} aria-label="Tela estável do aeroporto">
          <video autoPlay loop muted playsInline src={AIRPORT_VIDEO} />
        </div>
      ) : null}
      {showTimer ? (
        <div className={`${styles.timerOverlay} ${visibleTimer.status === "complete" ? styles.complete : ""}`} aria-live="assertive">
          {visibleTimer === collectionTimer ? <small>COLETA EM CURSO</small> : null}
          {visibleTimer === gincanaTimer ? <small>GINCANA · {gincana?.currentTask?.instruction}</small> : null}
          <strong>{seconds}</strong>
          {["complete", "completed", "failed"].includes(visibleTimer.status) ? <span>{visibleTimer.status === "completed" ? "CONCLUÍDA" : visibleTimer.status === "failed" ? "FALHOU" : "FIM"}</span> : null}
        </div>
      ) : null}
      {showParticipantSelection ? (
        <div className={styles.selectionOverlay} aria-live="assertive">
          {participantSelection.status === "countdown" ? (
            <div className={styles.volunteerCountdown}>
              <p>{participantSelection.invite}</p>
              <strong>{participantSeconds}</strong>
              <small>10 SEGUNDOS</small>
            </div>
          ) : null}
          {participantSelection.status === "roulette" ? (
            <div className={styles.roulette}>
              <span>ODDS EM TEMPO REAL*</span>
              <div className={styles.rouletteWindow} key={`${participantSelection.sequence}-${rouletteIndex}`}>
                {rouletteName}
              </div>
              <div className={styles.candidateTicker}>
                {selectionCandidates.map((candidate) => <span key={candidate.key}>{candidate.name}</span>)}
              </div>
              <p className={styles.rouletteComment}>{participantSelection.lastComment || "..."}</p>
              <small>* absolutamente nada aqui é uma odd real</small>
            </div>
          ) : null}
          {participantSelection.status === "selected" ? (
            <div className={styles.selectedParticipant}>
              <span>PARTICIPANTE ESCOLHIDO</span>
              <strong>{sceneZero.currentParticipant?.name || "—"}</strong>
              <p>{participantSelection.announcement}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
