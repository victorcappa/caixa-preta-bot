"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./SceneZeroProjectionLayer.module.css";

const AIRPORT_VIDEO = "/api/game-assets?file=videos%2Fglitch%2Fpainel-aeroporto.mp4";
const TEA_FOR_TWO_AUDIO = "/api/game-assets?file=audios%2FDoris%20Day%20-%20Tea%20For%20Two%20(1950).mp3";

function timerSeconds(timer, now) {
  if (timer?.status === "running" && timer.endsAt) {
    return Math.max(0, Math.ceil((Date.parse(timer.endsAt) - now) / 1000));
  }
  return timer?.remainingSeconds ?? 15;
}

export default function SceneZeroProjectionLayer({ sceneZero }) {
  const [now, setNow] = useState(Date.now());
  const audioRef = useRef(null);
  const tea = sceneZero?.teaForTwo;
  const timer = sceneZero?.timer;

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

  const showTimer = ["running", "paused", "complete"].includes(timer?.status);
  const seconds = timerSeconds(timer, now);
  const airport = sceneZero?.stage === "airport" || sceneZero?.airportActive;
  const collapse = sceneZero?.stage === "collapse";

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
        <div className={`${styles.timerOverlay} ${timer.status === "complete" ? styles.complete : ""}`} aria-live="assertive">
          <strong>{seconds}</strong>
          {timer.status === "complete" ? <span>FIM</span> : null}
        </div>
      ) : null}
    </>
  );
}
