"use client";

import { useEffect, useRef, useState } from "react";
import { PLAY_UNLOCK_CONFIG, PLAY_UNLOCK_STATES, playUnlockBootLines, playUnlockSequenceLines } from "@/data/scene-zero-unlock";
import {
  SCENE_ZERO_EVIDENCIAS_AUDIO_FILE,
  SCENE_ZERO_EVIDENCIAS_INTRO_SECONDS,
  SCENE_ZERO_EVIDENCIAS_LYRICS,
  SCENE_ZERO_EVIDENCIAS_PLAYBACK_RATE,
  sceneZeroEvidenciasFrameAt
} from "@/data/scene-zero-gincanas";
import { SCENE_ZERO_MOREL_BIOS_DURATION_MS, SCENE_ZERO_MOREL_BIOS_LINES, SCENE_ZERO_MOREL_BIOS_LINE_INTERVAL_MS } from "@/data/scene-zero-morel";
import { SCENE_ZERO_SUITCASE_CUE_DURATION_MS, sceneZeroSuitcaseCueFrameAt } from "@/lib/scene-zero/suitcaseGame";
import { AUDIENCE_WARMUP_MINIGAMES, getAudienceWarmupMinigame } from "@/data/audience-warmup-minigames";
import { SCENE_ZERO_HANGMAN_THEMES } from "@/data/scene-zero-hangman-words";
import { robotSoundEngine } from "@/lib/robot-sound/RobotSoundEngine";
import useCountdownSound from "./useCountdownSound";
import styles from "./SceneZeroProjectionLayer.module.css";

const AIRPORT_VIDEO = "/api/game-assets?file=videos%2Fglitch%2Fpainel-aeroporto.mp4";
const TEA_FOR_TWO_AUDIO = "/api/game-assets?file=audios%2FDoris%20Day%20-%20Tea%20For%20Two%20(1950).mp3";
const EVIDENCIAS_KARAOKE_AUDIO = `/api/game-assets?file=${encodeURIComponent(SCENE_ZERO_EVIDENCIAS_AUDIO_FILE)}`;

function timerSeconds(timer, now) {
  if (timer?.status === "running" && timer.endsAt) {
    const calculated = Math.max(0, Math.ceil((Date.parse(timer.endsAt) - now) / 1000));
    const configured = Number(timer.remainingSeconds ?? timer.durationSeconds);
    return Number.isFinite(configured) ? Math.min(configured, calculated) : calculated;
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

function SceneZeroTimerReadout({ seconds }) {
  return (
    <aside className={styles.sceneZeroTimer} data-scene-zero-timer aria-label={`Tempo: ${seconds} segundos`}>
      <strong>{seconds}</strong>
    </aside>
  );
}

function EvidenciasKaraoke({ timer, now }) {
  const elapsed = timerElapsedSeconds(timer, now);
  const frame = sceneZeroEvidenciasFrameAt(elapsed);
  const terminalLabel = timer?.status === "failed"
    ? "FALHOU"
    : (["complete", "completed"].includes(timer?.status) || frame.phase === "complete" ? "FIM" : "");

  return (
    <div className={styles.karaokeOverlay} aria-live="assertive">
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

function UnlockProgressBar({ progress, label, showValue = true }) {
  const value = Math.max(0, Math.min(100, Number(progress) || 0));
  return (
    <div className={styles.progressGroup}>
      {label ? <small className={styles.progressLabel}>{label}</small> : null}
      <div className={styles.unlockBar}>
        <div
          aria-label={`${label || "Progresso"}: ${value}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={value}
          className={styles.unlockTrack}
          role="progressbar"
        ><span style={{ width: `${value}%` }} /></div>
        {showValue ? <strong>{value}%</strong> : null}
      </div>
    </div>
  );
}

function AudienceSoundCheck({ unlock }) {
  const soundCheck = unlock?.soundCheck || {};
  const phase = soundCheck.phase;

  if (phase === "greeting") {
    return null;
  }

  if (phase === "confirmed") {
    return (
      <div className={styles.soundCheckConfirmed} aria-live="assertive">
        <div className={styles.soundMeter} data-complete="true">
          <span style={{ width: "100%" }} />
        </div>
        <small>SINAL DE VIDA · CONFIRMADO</small>
      </div>
    );
  }

  const levelPercent = Math.max(0, Math.min(100, Math.round(Number(soundCheck.liveLevel) || 0)));
  const holdProgress = Math.max(0, Math.min(100, Math.round(Number(soundCheck.holdProgress) || 0)));
  const microphoneUnavailable = soundCheck.microphoneStatus === "unavailable";
  return (
    <div className={styles.soundCheckListening}>
      <div className={styles.soundMeterGroup}>
        <div
          aria-label={`Nível sonoro: ${levelPercent}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={levelPercent}
          className={styles.soundMeter}
          role="progressbar"
        >
          <span style={{ width: `${levelPercent}%` }} />
          <i aria-hidden="true" style={{ left: `${PLAY_UNLOCK_CONFIG.soundCheck.thresholdPercent}%` }} />
          <b style={{ left: `${PLAY_UNLOCK_CONFIG.soundCheck.thresholdPercent}%` }}>META</b>
        </div>
        <div className={styles.soundMeterReadout}>
          <span>NÍVEL {levelPercent}%</span>
          <span>SINAL MANTIDO {holdProgress}%</span>
        </div>
      </div>
      <small className={microphoneUnavailable ? styles.soundCheckError : styles.soundCheckStatus}>
        {microphoneUnavailable
          ? "MICROFONE INDISPONÍVEL · USE O CONTROLE MANUAL DO OPERADOR"
          : soundCheck.microphoneStatus === "listening"
            ? "ESCUTANDO A SALA..."
            : "AGUARDANDO MICROFONE DO CONTROLLER..."}
      </small>
    </div>
  );
}

function PlayUnlockProjection({ unlock, now, pitchScale = 1, soundStyle = "robot" }) {
  const soundSequenceRef = useRef(null);
  const status = unlock?.status;
  const hidden = !status || status === PLAY_UNLOCK_STATES.STANDBY;
  const showStalledTerminal = status === PLAY_UNLOCK_STATES.BOOT_FAILED;
  const showCompletedTerminal = status === PLAY_UNLOCK_STATES.SOUND_CHECK
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
        : status === PLAY_UNLOCK_STATES.SOUND_CHECK
          ? (unlock.soundCheck?.phase === "confirmed" ? "progress" : "tick")
        : status === PLAY_UNLOCK_STATES.HUMAN_VERIFICATION
          ? "verification"
          : status === PLAY_UNLOCK_STATES.BOOT_FAILED
          ? "warning"
          : status === PLAY_UNLOCK_STATES.WARMING_AUDIENCE
            ? "progress"
            : PLAY_UNLOCK_CONFIG.bootSteps[unlock.bootStep]?.sound || "tick";
      const palette = soundStyle === "system95" ? PLAY_UNLOCK_CONFIG.system95Sounds : PLAY_UNLOCK_CONFIG.sounds;
      const sound = palette[soundId];
      const frequencies = Array.isArray(sound.frequencies) ? sound.frequencies : [sound.frequency];
      const baseTime = context.currentTime + 0.002;
      frequencies.forEach((frequency, index) => {
        const start = baseTime + ((Number(sound.stepMs) || 0) * index / 1000);
        const end = start + sound.durationMs / 1000;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = sound.oscillator;
        oscillator.frequency.value = frequency * pitchScale;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(sound.volume, start + Math.min(0.008, sound.durationMs / 4000));
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(end + 0.01);
        if (index === frequencies.length - 1) {
          oscillator.addEventListener("ended", () => context.close().catch(() => {}), { once: true });
        }
      });
    } catch {
      // Browsers may block boot audio before a physical interaction.
    }
  }, [status, unlock?.bootStep, unlock?.soundCheck?.phase, unlock?.soundEnabled, unlock?.soundSequence, hidden, pitchScale, soundStyle]);

  if (hidden) return null;

  if (status === PLAY_UNLOCK_STATES.BOOTING || showStalledTerminal || showCompletedTerminal) {
    const lines = [
      ...playUnlockBootLines(unlock.bootStep),
      ...(showStalledTerminal || showCompletedTerminal ? PLAY_UNLOCK_CONFIG.stalledLines : [])
    ];
    return (
      <section className={styles.biosOverlay} aria-label="BIOS da Cena 0" aria-live="polite">
        <div className={styles.biosTerminal}>
          <div className={styles.biosLines}>
            {lines.map((line, index) => <p key={`${index}-${line}`}>{line || "\u00a0"}</p>)}
          </div>
          <UnlockProgressBar key="bios-progress" label="CARREGAMENTO DA BIOS" progress={unlock.bootProgress} />
          {unlock.bootPaused ? <p className={styles.biosPaused}>BIOS PAUSADA PELO OPERADOR</p> : null}
        </div>
      </section>
    );
  }

  if (status === PLAY_UNLOCK_STATES.SOUND_CHECK) {
    return (
      <section className={`${styles.biosOverlay} ${styles.soundCheckOverlay}`} aria-label="Verificação sonora da plateia">
        <AudienceSoundCheck unlock={unlock} />
      </section>
    );
  }

  if (status === PLAY_UNLOCK_STATES.HUMAN_VERIFICATION && PLAY_UNLOCK_CONFIG.verificationTitle) {
    return (
      <section className={`${styles.biosOverlay} ${styles.verificationOverlay}`} aria-label="Protocolo de verificação humana" aria-live="assertive">
        <div className={styles.verificationTitle} key={unlock.verificationTitleSequence}>
          {PLAY_UNLOCK_CONFIG.verificationTitle ? <strong>{PLAY_UNLOCK_CONFIG.verificationTitle}</strong> : null}
          <UnlockProgressBar key="show-unlock-progress" label="DESBLOQUEIO DO ESPETÁCULO" progress={unlock.progress} />
        </div>
      </section>
    );
  }

  if (status === PLAY_UNLOCK_STATES.UNLOCKING) {
    return (
      <section className={`${styles.biosOverlay} ${styles.unlockingOverlay}`} aria-label="Sequência de desbloqueio da peça" aria-live="assertive">
        <div className={styles.biosTerminal}>
          <UnlockProgressBar key="show-unlock-progress" label="DESBLOQUEIO DO ESPETÁCULO" progress={unlock.progress} />
          <div className={styles.unlockLines}>
            {playUnlockSequenceLines(unlock.unlockSequenceSource)
              .slice(0, Number(unlock.unlockSequenceIndex ?? -1) + 1)
              .map((line) => <p key={line}>{line}</p>)}
          </div>
        </div>
      </section>
    );
  }

  return (
    <aside className={styles.unlockHud} data-unlock-hud aria-label="Progresso" aria-live="polite">
      <UnlockProgressBar key="show-unlock-progress" label="DESBLOQUEIO DO ESPETÁCULO" progress={unlock.progress} />
    </aside>
  );
}

export function SceneZeroStatusProjection({ sceneZero, pitchScale = 1, soundStyle = "robot" }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, []);

  return <PlayUnlockProjection now={now} pitchScale={pitchScale} soundStyle={soundStyle} unlock={sceneZero?.unlock} />;
}

function AudienceWarmupMinigameProjection({ warmup, now }) {
  const minigame = warmup?.minigame || {};
  const game = getAudienceWarmupMinigame(minigame.selectedId);
  const drawing = minigame.status === "drawing";
  const drawElapsed = Math.max(0, now - Date.parse(minigame.drawStartedAt || now));
  const drawIndex = Math.floor(drawElapsed / Math.max(70, 230 - Math.min(155, drawElapsed / 25))) % AUDIENCE_WARMUP_MINIGAMES.length;
  const drawName = AUDIENCE_WARMUP_MINIGAMES[drawIndex]?.name || "—";
  const seconds = timerSeconds(minigame.timer, now);
  const timerVisible = ["countdown", "running", "paused", "exchange"].includes(minigame.status);
  const selectedVisible = minigame.status === "selected";
  const secondRoundReady = minigame.status === "ready_round_two";

  useCountdownSound(seconds, {
    active: Boolean(timerVisible && minigame.timer?.status === "running"),
    countdownKey: `audience-warmup:${minigame.selectedId || "draw"}:${minigame.timer?.sequence || 0}`
  });

  useEffect(() => {
    if (drawing) robotSoundEngine.rouletteTick(drawIndex);
  }, [drawing, drawIndex]);

  useEffect(() => {
    if (minigame.status === "selected") robotSoundEngine.success();
    if (minigame.status === "running") robotSoundEngine.gameStart();
  }, [minigame.selectedId, minigame.status, minigame.timer?.startedAt]);

  if (!drawing && !selectedVisible && !timerVisible && !secondRoundReady) return null;

  return (
    <section className={styles.warmupMinigameOverlay} aria-label="Minigame do aquecimento" aria-live="assertive">
      {drawing ? (
        <div className={styles.warmupGameDraw}>
          <span>SORTEANDO TESTE</span>
          <div className={styles.rouletteWindow} key={`warmup-${drawIndex}`}>{drawName}</div>
          <div className={styles.candidateTicker}>
            {AUDIENCE_WARMUP_MINIGAMES.map((candidate) => <span key={candidate.id}>{candidate.name}</span>)}
          </div>
        </div>
      ) : selectedVisible ? (
        <div className={styles.warmupGameSelected}>
          <span>JOGO SELECIONADO</span>
          <strong>{game?.name || "—"}</strong>
        </div>
      ) : secondRoundReady ? (
        <div className={styles.warmupGameSelected}>
          <span>TAPÃO</span>
          <strong>SEGUNDO TURNO</strong>
          <small>AGUARDANDO OPERADOR</small>
        </div>
      ) : (
        <div className={styles.warmupGameTimer} data-paused={minigame.status === "paused"}>
          <header><span>{game?.name || "TESTE"}</span><b>{minigame.timer?.phase === "round_two" ? "TURNO 2" : minigame.timer?.phase === "exchange" ? "TROQUEM" : minigame.timer?.phase === "countdown" ? "COMEÇANDO" : "TURNO 1"}</b></header>
        </div>
      )}
    </section>
  );
}

function AudienceWarmupActionCountdownSound({ warmup, now }) {
  const timer = warmup?.actionTimer;
  const seconds = timerSeconds(timer, now);
  const visible = warmup?.phase === "questions" && timer?.status === "running";
  useCountdownSound(seconds, {
    active: visible,
    countdownKey: `audience-warmup-action:${warmup?.sequence?.id || "none"}:${warmup?.currentStep ?? -1}`
  });
  return null;
}

export default function SceneZeroProjectionLayer({ sceneZero, audienceWarmup }) {
  const [now, setNow] = useState(Date.now());
  const teaAudioRef = useRef(null);
  const evidenciasAudioRef = useRef(null);
  const tea = sceneZero?.teaForTwo;
  const timer = sceneZero?.timer;
  const collectionTimer = sceneZero?.collection?.activeCountdown;
  const gincana = sceneZero?.suitcaseGame?.gincana;
  const gincanaTimer = gincana?.timer;
  const hangman = sceneZero?.suitcaseGame?.hangman || {};
  const hangmanPublic = hangman.activity?.publicState || {};
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

    audio.playbackRate = SCENE_ZERO_EVIDENCIAS_PLAYBACK_RATE;
    const targetTime = timerElapsedSeconds(gincanaTimer, Date.now()) * SCENE_ZERO_EVIDENCIAS_PLAYBACK_RATE;
    if (Math.abs(audio.currentTime - targetTime) > 0.35) audio.currentTime = targetTime;

    if (gincanaTimer.status === "paused") {
      audio.pause();
      return;
    }

    audio.play().catch(() => {});
  }, [gincana?.currentTask?.id, gincanaTimer]);

  const visibleTimer = sceneZero?.stage === "collection" && ["running", "complete"].includes(collectionTimer?.status)
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
  const showParticipantSelection = ["preparing", "countdown", "roulette", "selected"].includes(participantSelection.status);
  const participantSeconds = participantSelection.status === "countdown"
    ? countdownSeconds(participantSelection.countdownEndsAt, now)
    : null;
  const suitcaseSelectionAge = now - Date.parse(sceneZero?.suitcaseGame?.suitcaseSelectedAt || "");
  const suitcaseCueFrame = sceneZeroSuitcaseCueFrameAt(suitcaseSelectionAge, sceneZero?.suitcaseGame?.currentSuitcase);
  const suitcaseCuePhase = sceneZero?.suitcaseGame?.cuePhase || "idle";
  const manualSuitcaseCue = ["drawing", "selected", "open"].includes(suitcaseCuePhase);
  const showSuitcaseSelection = Boolean(
    sceneZero?.suitcaseGame?.currentSuitcase
    && suitcaseSelectionAge >= 0
    && (manualSuitcaseCue || suitcaseSelectionAge < SCENE_ZERO_SUITCASE_CUE_DURATION_MS && suitcaseCuePhase === "automatic")
    && !showTimer
  );
  const showPhysicalChallenge = Boolean(
    sceneZero?.suitcaseGame?.currentSuitcase === 2
    && gincana?.currentTask
    && (suitcaseCuePhase === "complete" || suitcaseSelectionAge >= SCENE_ZERO_SUITCASE_CUE_DURATION_MS)
    && ["running", "paused"].includes(gincanaTimer?.status)
  );
  const physicalSeconds = timerSeconds(gincanaTimer, now);
  const physicalUrgent = gincanaTimer?.status === "running" && physicalSeconds <= 3;
  const showHangman = Boolean(
    sceneZero?.suitcaseGame?.currentSuitcase === 3
    && hangman?.activity
    && hangman.status === "active"
    && (suitcaseCuePhase === "complete" || suitcaseSelectionAge >= SCENE_ZERO_SUITCASE_CUE_DURATION_MS)
  );
  const themeDraw = hangman.themeDraw || {};
  const showHangmanThemeDraw = sceneZero?.suitcaseGame?.currentSuitcase === 3
    && (themeDraw.status === "drawing" || themeDraw.status === "selected" && hangman.status === "ready");
  const themeDrawElapsed = Math.max(0, now - Date.parse(themeDraw.startedAt || now));
  const themeDrawIndex = Math.floor(themeDrawElapsed / Math.max(70, 230 - Math.min(155, themeDrawElapsed / 25))) % SCENE_ZERO_HANGMAN_THEMES.length;
  const hangmanSeconds = timerSeconds(hangman?.timer, now);
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
  const allVisibleMorelLines = showMorelBios && !morelBlackout
    ? SCENE_ZERO_MOREL_BIOS_LINES.slice(0, Math.min(
      SCENE_ZERO_MOREL_BIOS_LINES.length,
      Math.floor(morelBiosAge / SCENE_ZERO_MOREL_BIOS_LINE_INTERVAL_MS) + 1
    ))
    : [];
  const visibleMorelLines = allVisibleMorelLines.slice(-10);
  const visibleMorelStartIndex = Math.max(0, allVisibleMorelLines.length - visibleMorelLines.length);
  const warmupMinigameVisible = ["drawing", "selected", "countdown", "running", "paused", "exchange", "ready_round_two"].includes(audienceWarmup?.minigame?.status);
  const warmupMinigameTimerVisible = ["countdown", "running", "paused", "exchange"].includes(audienceWarmup?.minigame?.status);
  const warmupMinigameSeconds = timerSeconds(audienceWarmup?.minigame?.timer, now);
  const warmupActionVisible = audienceWarmup?.phase === "questions" && audienceWarmup?.actionTimer?.status === "running";
  const warmupActionSeconds = timerSeconds(audienceWarmup?.actionTimer, now);
  const fixedTimer = showPhysicalChallenge
    ? { seconds: physicalSeconds, status: gincanaTimer?.status === "paused" ? "PAUSADO" : "" }
    : showHangman
      ? { seconds: hangmanSeconds, status: "" }
      : showTimer
        ? { seconds, status: visibleTimer?.status === "paused" ? "PAUSADO" : "" }
        : participantSelection.status === "countdown"
          ? { seconds: participantSeconds, status: "" }
          : warmupActionVisible
            ? { seconds: warmupActionSeconds, status: "" }
            : warmupMinigameTimerVisible
              ? {
                  seconds: warmupMinigameSeconds,
                  status: audienceWarmup.minigame.status === "paused"
                    ? "PAUSADO"
                    : audienceWarmup.minigame.timer?.phase === "exchange"
                      ? "INVERTAM OS PAPÉIS"
                      : ""
                }
              : null;
  const auxiliaryActive = Boolean(
    collapse
    || airport
    || showTimer
    || showSuitcaseSelection
    || showPhysicalChallenge
    || showHangmanThemeDraw
    || showHangman
    || showMorelBios
    || showParticipantSelection
    || warmupMinigameVisible
    || warmupActionVisible
  );

  useCountdownSound(seconds, {
    active: Boolean(showTimer && !showEvidenciasKaraoke && ["running", "complete"].includes(visibleTimer?.status)),
    countdownKey: `scene-zero:${visibleTimer === gincanaTimer ? "gincana" : visibleTimer === collectionTimer ? "collection" : "singing"}:${visibleTimer?.sequence || 0}`
  });
  useCountdownSound(participantSeconds, {
    active: participantSelection.status === "countdown",
    countdownKey: `scene-zero:participant:${participantSelection.sequence || 0}`
  });
  useCountdownSound(physicalSeconds, {
    active: Boolean(showPhysicalChallenge && ["running", "complete"].includes(gincanaTimer?.status)),
    countdownKey: `scene-zero:physical:${gincanaTimer?.sequence || 0}`
  });
  useCountdownSound(hangmanSeconds, {
    active: Boolean(showHangman && hangman?.status === "active"),
    countdownKey: `scene-zero:hangman:${hangman?.timer?.sequence || 0}`
  });

  useEffect(() => {
    if (participantSelection.status === "roulette") robotSoundEngine.rouletteTick(rouletteIndex);
  }, [participantSelection.status, rouletteIndex]);

  useEffect(() => {
    if (themeDraw.status === "drawing") robotSoundEngine.rouletteTick(themeDrawIndex);
  }, [themeDraw.status, themeDrawIndex]);

  useEffect(() => {
    if (themeDraw.status === "selected") robotSoundEngine.success();
  }, [themeDraw.status, themeDraw.sequence]);

  useEffect(() => {
    if (participantSelection.status === "selected") robotSoundEngine.success();
  }, [participantSelection.sequence, participantSelection.status]);

  useEffect(() => {
    if (!showSuitcaseSelection) return;
    if (suitcaseCueFrame.phase === "roulette") robotSoundEngine.rouletteTick(suitcaseCueFrame.number);
    else robotSoundEngine.gameStart();
  }, [sceneZero?.suitcaseGame?.suitcaseSelectionSequence, showSuitcaseSelection, suitcaseCueFrame.number, suitcaseCueFrame.phase]);

  useEffect(() => {
    if (hangman?.status !== "active") return undefined;
    let step = 0;
    robotSoundEngine.gameStart();
    robotSoundEngine.hangmanPulse(step);
    const interval = window.setInterval(() => {
      step += 1;
      robotSoundEngine.hangmanPulse(step);
    }, 720);
    return () => {
      window.clearInterval(interval);
      robotSoundEngine.stopHangmanMusic();
    };
  }, [hangman?.status, hangman?.timer?.startedAt]);

  const hangmanResultSoundRef = useRef(null);
  useEffect(() => {
    if (!["won", "lost"].includes(hangman?.status)) return;
    const resultKey = `${hangman.sequence}:${hangman.status}`;
    if (hangmanResultSoundRef.current === resultKey) return;
    hangmanResultSoundRef.current = resultKey;
    if (hangman.status === "won") robotSoundEngine.success();
    else robotSoundEngine.error();
  }, [hangman?.sequence, hangman?.status]);

  return (
    <>
      <span data-scene-zero-aux-active={auxiliaryActive ? "true" : "false"} hidden />
      <audio preload="auto" ref={teaAudioRef} src={TEA_FOR_TWO_AUDIO} />
      <audio preload="auto" ref={evidenciasAudioRef} src={EVIDENCIAS_KARAOKE_AUDIO} />
      <AudienceWarmupMinigameProjection now={now} warmup={audienceWarmup} />
      <AudienceWarmupActionCountdownSound now={now} warmup={audienceWarmup} />
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
        <EvidenciasKaraoke now={now} timer={gincanaTimer} />
      ) : showTimer ? (
        <div className={`${styles.timerOverlay} ${visibleTimer.status === "complete" ? styles.complete : ""}`} aria-live="assertive">
          {visibleTimer === collectionTimer ? <small>COLETA EM CURSO</small> : null}
          {visibleTimer === gincanaTimer ? <small>ADIVINHE O OBJETO · APENAS PELO CHEIRO</small> : null}
          {["complete", "completed", "failed"].includes(visibleTimer.status) ? <span>{visibleTimer.status === "completed" ? "CONCLUÍDA" : visibleTimer.status === "failed" ? "FALHOU" : "FIM"}</span> : null}
        </div>
      ) : null}
      {showSuitcaseSelection ? (
        <div className={styles.suitcaseCueOverlay} key={sceneZero.suitcaseGame.suitcaseSelectionSequence} aria-label={`Mala indicada: ${sceneZero.suitcaseGame.currentSuitcase}`} aria-live="assertive">
          <span>{manualSuitcaseCue ? suitcaseCuePhase === "open" ? "ABRA A MALA" : "" : suitcaseCueFrame.phase === "reveal" ? "ABRA A MALA" : ""}</span>
          <strong key={`${suitcaseCueFrame.phase}-${suitcaseCueFrame.number}`}>{suitcaseCueFrame.number}</strong>
        </div>
      ) : null}
      {showPhysicalChallenge ? (
        <section className={`${styles.physicalChallengeOverlay} ${physicalUrgent ? styles.physicalChallengeUrgent : ""}`} aria-label="Desafio com objeto da Mala 2" aria-live="assertive">
          <header><span>MALA 2</span><b>DESAFIO COM OBJETO</b></header>
          <div className={styles.physicalChallengeBody}>
            <div className={styles.physicalChallengeSteps}>
              <article data-active="true">
                <small>OBJETOS · {gincana.currentTask.objectDuration || 15}s</small>
                <p>{gincana.currentTask.text || gincana.currentTask.instruction}</p>
              </article>
            </div>
            <div className={styles.physicalChallengeReadout}>
              <span>ALVO<strong>{gincana.currentTask.target}</strong></span>
            </div>
          </div>
          {gincana.result === "completed" ? (
            <div className={styles.physicalChallengeResult} data-success="true">
              <strong>{gincana.currentTask.target}/{gincana.currentTask.target}</strong>
              <span>{gincana.currentTask.successMessage}</span>
              <small>PRÓXIMO TESTE.</small>
            </div>
          ) : gincana.result === "failed" ? (
            <div className={styles.physicalChallengeResult}>
              <strong>FALHA</strong>
              <span>{gincana.currentTask.failureMessage}</span>
              <small>PRÓXIMO TESTE.</small>
            </div>
          ) : gincanaTimer?.status === "complete" ? (
            <div className={styles.physicalChallengeResult}>
              <strong>0</strong>
              <span>TEMPO ESGOTADO.</span>
            </div>
          ) : gincanaTimer?.status !== "running" ? (
            <small className={styles.physicalChallengeStatus}>{gincanaTimer?.status === "paused" ? "PAUSADO" : "AGUARDANDO INÍCIO"}</small>
          ) : null}
        </section>
      ) : null}
      {showHangmanThemeDraw ? (
        <section className={styles.warmupMinigameOverlay} aria-label="Sorteio do tema da Forca" aria-live="assertive">
          {themeDraw.status === "drawing" ? (
            <div className={styles.warmupGameDraw}>
              <span>SORTEANDO TEMA DA FORCA</span>
              <div className={styles.rouletteWindow} key={`hangman-theme-${themeDrawIndex}`}>{SCENE_ZERO_HANGMAN_THEMES[themeDrawIndex]}</div>
              <div className={styles.candidateTicker}>
                {SCENE_ZERO_HANGMAN_THEMES.map((theme) => <span key={theme}>{theme}</span>)}
              </div>
            </div>
          ) : (
            <div className={styles.warmupGameSelected}>
              <span>TEMA SORTEADO</span>
              <strong>{hangman.theme?.toUpperCase() || "—"}</strong>
            </div>
          )}
        </section>
      ) : null}
      {showHangman ? (
        <section
          className={`${styles.suitcaseHangmanOverlay} ${styles[`hangmanErrors${Math.min(4, Number(hangman.errorCount) || 0)}`] || ""}`}
          aria-label="Forca da Mala 3"
          aria-live="assertive"
          style={{
            "--descent": `${Math.min(100, (Number(hangman.errorCount) || 0) * 25)}%`,
            "--descent-angle": `${Math.min(36, (Number(hangman.errorCount) || 0) * 9)}deg`
          }}
        >
          <div className={styles.hangmanInterference} aria-hidden="true" />
          <header><span>MALA 3 / FORCA</span><strong>{hangman.flightState || "ESTÁVEL"}</strong></header>
          <p className={styles.hangmanTheme}><span>TEMA:</span> <strong>{(hangman.theme || "NÃO INFORMADO").toUpperCase()}</strong></p>
          <p className={styles.hangmanWord}>{hangmanPublic.progress || "_ _ _"}</p>
          <div className={styles.hangmanFlight} aria-hidden="true">
            <span>✈</span><i />
          </div>
          <div className={styles.hangmanTelemetry}>
            <span>ERROS <b>{hangman.errorCount || 0}/4</b></span>
            <span>USADAS <b>{(hangmanPublic.usedGuesses || []).join(" · ").toUpperCase() || "—"}</b></span>
          </div>
          {hangman.resultMessage ? (
            <div className={styles.hangmanResult}>
              <strong>{hangman.resultMessage}</strong>
              {hangman.revealedWord ? <span>{hangman.revealedWord}</span> : null}
            </div>
          ) : null}
        </section>
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
                  <span aria-hidden="true">{String(visibleMorelStartIndex + index).padStart(2, "0")}</span>{line}
                </p>
              ))}
              <i aria-hidden="true" />
            </div>
          </> : null}
        </section>
      ) : null}
      {showParticipantSelection ? (
        <div className={styles.selectionOverlay} aria-live="assertive">
          {participantSelection.status === "preparing" ? (
            <div className={styles.participantThinking} aria-label="Pensando em qual participante escolher">
              <span aria-hidden="true">/pensando</span>
              <span className={styles.thinkingDots} aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
            </div>
          ) : null}
          {participantSelection.status === "countdown" ? (
            <div className={styles.volunteerCountdown}>
              <p>{participantSelection.invite}</p>
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
              <p>{participantSelection.lastComment || participantSelection.announcement}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {fixedTimer ? <SceneZeroTimerReadout seconds={fixedTimer.seconds} /> : null}
    </>
  );
}
