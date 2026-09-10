"use client";

import { useEffect, useRef, useState } from "react";
import { PLAY_UNLOCK_CONFIG, PLAY_UNLOCK_STATES, playUnlockBootLines } from "@/data/scene-zero-unlock";
import {
  SCENE_ZERO_EVIDENCIAS_AUDIO_FILE,
  SCENE_ZERO_EVIDENCIAS_INTRO_SECONDS,
  SCENE_ZERO_EVIDENCIAS_LYRICS,
  sceneZeroEvidenciasFrameAt
} from "@/data/scene-zero-gincanas";
import { SCENE_ZERO_MOREL_BIOS_DURATION_MS, SCENE_ZERO_MOREL_BIOS_LINES, SCENE_ZERO_MOREL_BIOS_LINE_INTERVAL_MS } from "@/data/scene-zero-morel";
import { SCENE_ZERO_SUITCASE_CUE_DURATION_MS, shouldShowGincanaTimer } from "@/lib/scene-zero/suitcaseGame";
import BlinkingCursor from "./BlinkingCursor";
import useCountdownSound from "./useCountdownSound";
import styles from "./SceneZeroProjectionLayer.module.css";

const AIRPORT_VIDEO = "/api/game-assets?file=videos%2Fglitch%2Fpainel-aeroporto.mp4";
const TEA_FOR_TWO_AUDIO = "/api/game-assets?file=audios%2FDoris%20Day%20-%20Tea%20For%20Two%20(1950).mp3";
const EVIDENCIAS_KARAOKE_AUDIO = `/api/game-assets?file=${encodeURIComponent(SCENE_ZERO_EVIDENCIAS_AUDIO_FILE)}`;

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

function timerElapsedSeconds(timer, now) {
  const duration = Number(timer?.durationSeconds) || 0;
  if (timer?.status === "running" && timer.endsAt) {
    return Math.max(0, Math.min(duration, duration - ((Date.parse(timer.endsAt) - now) / 1000)));
  }
  if (timer?.status === "paused") {
    return Math.max(0, Math.min(duration, duration - (Number(timer.remainingSeconds) || 0)));
  }
  if (["complete", "completed"].includes(timer?.status)) return duration;
  return 0;
}

function EvidenciasKaraoke({ timer, now, seconds }) {
  const elapsed = timerElapsedSeconds(timer, now);
  const frame = sceneZeroEvidenciasFrameAt(elapsed);
  const terminalLabel = timer?.status === "failed"
    ? "FALHOU"
    : (["complete", "completed"].includes(timer?.status) || frame.phase === "complete" ? "FIM" : "");

  return (
    <div className={styles.karaokeOverlay} aria-live="assertive">
      <span className={styles.karaokeCountdown}>{seconds}</span>
      {terminalLabel ? (
        <strong className={styles.karaokeFinished}>{terminalLabel}</strong>
      ) : frame.phase === "intro" ? (
        <div className={styles.karaokeIntro} aria-label={`Introdução: ${frame.activeDots} de ${SCENE_ZERO_EVIDENCIAS_INTRO_SECONDS} segundos`}>
          <small>INTRO</small>
          <strong aria-hidden="true">
            {Array.from({ length: SCENE_ZERO_EVIDENCIAS_INTRO_SECONDS }, (_, index) => (
              <i className={index < frame.activeDots ? styles.karaokeDotActive : ""} key={index}>.</i>
            ))}
          </strong>
        </div>
      ) : (
        <div className={styles.karaokeSingAlong}>
          <small>EVIDÊNCIAS · CANTE JUNTO</small>
          <div className={styles.karaokeLyrics}>
            {SCENE_ZERO_EVIDENCIAS_LYRICS.slice(0, frame.lineIndex + 1).map((line, index) => (
              <p className={index === frame.lineIndex ? styles.karaokeCurrentLine : ""} key={line.text}>{line.text}</p>
            ))}
          </div>
          <div className={styles.karaokeProgress} aria-hidden="true"><span style={{ width: `${frame.lineProgress * 100}%` }} /></div>
        </div>
      )}
    </div>
  );
}

function UnlockProgressBar({ progress, showValue = true }) {
  const value = Math.max(0, Math.min(100, Number(progress) || 0));
  return (
    <div className={styles.unlockBar}>
      <div
        aria-label={`Progresso: ${value}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={value}
        className={styles.unlockTrack}
        role="progressbar"
      ><span style={{ width: `${value}%` }} /></div>
      {showValue ? <strong>{value}%</strong> : null}
    </div>
  );
}

function PlayUnlockProjection({ unlock, now }) {
  const soundSequenceRef = useRef(null);
  const status = unlock?.status;
  const hidden = !status || [PLAY_UNLOCK_STATES.STANDBY, PLAY_UNLOCK_STATES.UNLOCKED].includes(status);
  const showStalledTerminal = status === PLAY_UNLOCK_STATES.BOOT_FAILED
    && Date.parse(unlock.handoffUntil || "") > now;

  useEffect(() => {
    if (hidden || unlock.soundEnabled === false || soundSequenceRef.current === unlock.soundSequence) return;
    soundSequenceRef.current = unlock.soundSequence;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = AudioContext ? new AudioContext() : null;
      if (!context) return;
      const soundId = status === PLAY_UNLOCK_STATES.UNLOCKING
        ? "unlock"
        : status === PLAY_UNLOCK_STATES.HUMAN_VERIFICATION
          ? "verification"
          : status === PLAY_UNLOCK_STATES.BOOT_FAILED
          ? "warning"
          : status === PLAY_UNLOCK_STATES.WARMING_AUDIENCE
            ? "progress"
            : PLAY_UNLOCK_CONFIG.bootSteps[unlock.bootStep]?.sound || "tick";
      const sound = PLAY_UNLOCK_CONFIG.sounds[soundId];
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = sound.oscillator;
      oscillator.frequency.value = sound.frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(sound.volume, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + sound.durationMs / 1000);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + sound.durationMs / 1000 + 0.01);
      oscillator.addEventListener("ended", () => context.close().catch(() => {}), { once: true });
    } catch {
      // Browsers may block boot audio before a physical interaction.
    }
  }, [status, unlock?.bootStep, unlock?.soundEnabled, unlock?.soundSequence, hidden]);

  if (hidden) return null;

  if (status === PLAY_UNLOCK_STATES.BOOTING || showStalledTerminal) {
    const lines = [
      ...playUnlockBootLines(unlock.bootStep),
      ...(showStalledTerminal ? PLAY_UNLOCK_CONFIG.stalledLines : [])
    ];
    return (
      <section className={styles.biosOverlay} aria-label="BIOS da Cena 0" aria-live="polite">
        <div className={styles.biosTerminal}>
          <div className={styles.biosLines}>
            {lines.map((line, index) => <p key={`${index}-${line}`}>{line || "\u00a0"}</p>)}
          </div>
          <UnlockProgressBar progress={unlock.progress} />
          {unlock.bootPaused ? <p className={styles.biosPaused}>BIOS PAUSADA PELO OPERADOR</p> : null}
        </div>
      </section>
    );
  }

  if (status === PLAY_UNLOCK_STATES.BOOT_FAILED) {
    return (
      <section className={`${styles.biosOverlay} ${styles.waitingCursorOverlay}`} aria-label="Aguardando início do aquecimento">
        <BlinkingCursor />
      </section>
    );
  }

  if (status === PLAY_UNLOCK_STATES.HUMAN_VERIFICATION) {
    return (
      <section className={`${styles.biosOverlay} ${styles.verificationOverlay}`} aria-label="Protocolo de verificação humana" aria-live="assertive">
        <div className={styles.verificationTitle} key={unlock.verificationTitleSequence}>
          <strong>{PLAY_UNLOCK_CONFIG.verificationTitle}</strong>
          <UnlockProgressBar progress={unlock.progress} />
        </div>
      </section>
    );
  }

  if (status === PLAY_UNLOCK_STATES.UNLOCKING) {
    return (
      <section className={`${styles.biosOverlay} ${styles.unlockingOverlay}`} aria-label="Sequência de desbloqueio da peça" aria-live="assertive">
        <div className={styles.biosTerminal}>
          <UnlockProgressBar progress={100} />
          <div className={styles.unlockLines}>
            {PLAY_UNLOCK_CONFIG.unlockLines
              .slice(0, Number(unlock.unlockSequenceIndex ?? -1) + 1)
              .map((line) => <p key={line}>{line}</p>)}
          </div>
        </div>
      </section>
    );
  }

  return (
    <aside className={styles.unlockHud} aria-label="Progresso" aria-live="polite">
      <UnlockProgressBar progress={unlock.progress} showValue={false} />
    </aside>
  );
}

export default function SceneZeroProjectionLayer({ sceneZero }) {
  const [now, setNow] = useState(Date.now());
  const teaAudioRef = useRef(null);
  const evidenciasAudioRef = useRef(null);
  const tea = sceneZero?.teaForTwo;
  const timer = sceneZero?.timer;
  const collectionTimer = sceneZero?.collection?.activeCountdown;
  const gincana = sceneZero?.suitcaseGame?.gincana;
  const gincanaTimer = gincana?.timer;
  const morelBios = sceneZero?.suitcaseGame?.morelBios;
  const participantSelection = sceneZero?.participantSelection || {};

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const audio = teaAudioRef.current;
    if (!audio) return;

    if (tea?.status !== "playing") {
      audio.pause();
      audio.currentTime = 0;
      return;
    }

    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, [tea?.sequence, tea?.status]);

  useEffect(() => {
    const audio = evidenciasAudioRef.current;
    const isEvidencias = gincana?.currentTask?.id === "evidencias_objeto_microfone";
    if (!audio) return;

    if (!isEvidencias || !["running", "paused"].includes(gincanaTimer?.status)) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }

    const targetTime = timerElapsedSeconds(gincanaTimer, Date.now());
    if (Math.abs(audio.currentTime - targetTime) > 0.35) audio.currentTime = targetTime;

    if (gincanaTimer.status === "paused") {
      audio.pause();
      return;
    }

    audio.play().catch(() => {});
  }, [gincana?.currentTask?.id, gincanaTimer]);

  const gincanaCompletionAge = now - Date.parse(gincanaTimer?.completedAt || "");
  const gincanaTimerVisible = shouldShowGincanaTimer(gincanaTimer)
    && (!["complete", "completed"].includes(gincanaTimer?.status) || (gincanaCompletionAge >= 0 && gincanaCompletionAge < 2000));
  const visibleTimer = [2, 3].includes(sceneZero?.suitcaseGame?.currentSuitcase) && gincanaTimerVisible
    ? gincanaTimer
    : sceneZero?.stage === "collection" && ["running", "complete"].includes(collectionTimer?.status)
      ? collectionTimer
      : sceneZero?.stage === "singing" ? timer : null;
  const showTimer = ["running", "paused", "complete", "completed", "failed"].includes(visibleTimer?.status);
  const showEvidenciasKaraoke = showTimer
    && visibleTimer === gincanaTimer
    && gincana?.currentTask?.id === "evidencias_objeto_microfone";
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
  const suitcaseSelectionAge = now - Date.parse(sceneZero?.suitcaseGame?.suitcaseSelectedAt || "");
  const showSuitcaseSelection = Boolean(
    sceneZero?.suitcaseGame?.currentSuitcase
    && suitcaseSelectionAge >= 0
    && suitcaseSelectionAge < SCENE_ZERO_SUITCASE_CUE_DURATION_MS
    && !showTimer
  );
  const morelBiosAge = now - Date.parse(morelBios?.startedAt || "");
  const showMorelBios = Boolean(
    sceneZero?.suitcaseGame?.currentSuitcase === 1
    && morelBios?.status === "running"
    && morelBiosAge >= 0
  );
  const morelBiosProgress = showMorelBios
    ? Math.max(0, Math.min(1, morelBiosAge / SCENE_ZERO_MOREL_BIOS_DURATION_MS))
    : 0;
  const morelCorruptionLevel = Math.min(4, Math.floor(morelBiosProgress * 5));
  const morelCorruptionClass = morelCorruptionLevel ? styles[`morelCorruption${morelCorruptionLevel}`] : "";
  const morelBlackout = showMorelBios && morelBiosAge >= SCENE_ZERO_MOREL_BIOS_DURATION_MS;
  const visibleMorelLines = showMorelBios && !morelBlackout
    ? SCENE_ZERO_MOREL_BIOS_LINES.slice(0, Math.min(
      SCENE_ZERO_MOREL_BIOS_LINES.length,
      Math.floor(morelBiosAge / SCENE_ZERO_MOREL_BIOS_LINE_INTERVAL_MS) + 1
    ))
    : [];

  useCountdownSound(seconds, {
    active: Boolean(showTimer && !showEvidenciasKaraoke && ["running", "complete"].includes(visibleTimer?.status)),
    countdownKey: `scene-zero:${visibleTimer === gincanaTimer ? "gincana" : visibleTimer === collectionTimer ? "collection" : "singing"}:${visibleTimer?.sequence || 0}`
  });
  useCountdownSound(participantSeconds, {
    active: participantSelection.status === "countdown",
    countdownKey: `scene-zero:participant:${participantSelection.sequence || 0}`
  });

  return (
    <>
      <audio preload="auto" ref={teaAudioRef} src={TEA_FOR_TWO_AUDIO} />
      <audio preload="auto" ref={evidenciasAudioRef} src={EVIDENCIAS_KARAOKE_AUDIO} />
      <PlayUnlockProjection now={now} unlock={sceneZero?.unlock} />
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
      {showEvidenciasKaraoke ? (
        <EvidenciasKaraoke now={now} seconds={seconds} timer={gincanaTimer} />
      ) : showTimer ? (
        <div className={`${styles.timerOverlay} ${visibleTimer.status === "complete" ? styles.complete : ""}`} aria-live="assertive">
          {visibleTimer === collectionTimer ? <small>COLETA EM CURSO</small> : null}
          {visibleTimer === gincanaTimer ? <small>ADIVINHE O OBJETO · APENAS PELO CHEIRO</small> : null}
          <strong>{seconds}</strong>
          {["complete", "completed", "failed"].includes(visibleTimer.status) ? <span>{visibleTimer.status === "completed" ? "CONCLUÍDA" : visibleTimer.status === "failed" ? "FALHOU" : "FIM"}</span> : null}
        </div>
      ) : null}
      {showSuitcaseSelection ? (
        <div className={styles.suitcaseCueOverlay} key={sceneZero.suitcaseGame.suitcaseSelectionSequence} aria-label={`Mala indicada: ${sceneZero.suitcaseGame.currentSuitcase}`} aria-live="assertive">
          <strong>{sceneZero.suitcaseGame.currentSuitcase}</strong>
        </div>
      ) : null}
      {showMorelBios ? (
        <section
          className={`${styles.morelBiosOverlay} ${morelCorruptionClass} ${morelBlackout ? styles.morelBlackout : ""}`}
          key={morelBios.sequence}
          aria-label={morelBlackout ? "Blackout final" : "Nova BIOS corrompida"}
          aria-live="assertive"
          style={{
            "--bios-noise-opacity": 0.12 + (morelBiosProgress * 0.58),
            "--bios-noise-speed": `${Math.max(0.1, 0.32 - (morelBiosProgress * 0.22))}s`,
            "--bios-shift": `${Math.round(morelBiosProgress * 18)}px`,
            "--bios-shift-negative": `${Math.round(morelBiosProgress * -18)}px`
          }}
        >
          {!morelBlackout ? <>
            <div className={styles.morelBiosNoise} aria-hidden="true" />
            <div className={styles.morelBiosTerminal}>
              {visibleMorelLines.map((line, index) => (
                <p key={line}>
                  <span aria-hidden="true">{String(index).padStart(2, "0")}</span>{line}
                </p>
              ))}
              <i aria-hidden="true" />
            </div>
          </> : null}
        </section>
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
