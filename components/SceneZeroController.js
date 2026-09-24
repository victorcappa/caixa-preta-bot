"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InstagramBrowserPanel from "./InstagramBrowserPanel";
import AudienceWarmupController from "./AudienceWarmupController";
import { setSharedInstagramPanelVisible } from "@/lib/instagram/panelClient";
import { robotSoundEngine } from "@/lib/robot-sound/RobotSoundEngine";
import { robotMicrophoneSensitivity } from "@/lib/robot-sound/state";
import { SCENE_ZERO_GLITCH_LEVELS, SCENE_ZERO_PERSONALITY_DIRECTIONS, SCENE_ZERO_STAGES, sceneZeroStageLabel } from "@/lib/scene-zero/state";
import { nextSceneZeroSuitcase } from "@/lib/scene-zero/suitcaseGame";
import { SCENE_ZERO_HANGMAN_WORDS } from "@/data/scene-zero-hangman-words";
import { PLAY_UNLOCK_CONFIG } from "@/data/scene-zero-unlock";
import { audienceWarmupResponseOptions } from "@/data/audience-warmup-reactions";
import { AUDIENCE_WARMUP_PROMPTS } from "@/data/audience-warmup-prompts";
import styles from "./SceneZeroController.module.css";

const PRIMARY_STAGES = [
  ["collection", "COLETA DE DADOS"],
  ["participant", "ESCOLHER PARTICIPANTE"],
  ["suitcases", "JOGO DAS MALAS"],
  ["cake", "É BOLO?"],
  ["singing", "MALA — CANTAR 15s"],
  ["glitch", "GLITCH"],
  ["instagram", "INSTAGRAM"],
  ["collapse", "GLITCH / COLAPSO"],
  ["airport", "AEROPORTO"],
  ["tea", "TEA FOR TWO"]
];

const COLLECTION_RESULTS = [
  ["none", "NINGUÉM"],
  ["few", "POUCOS"],
  ["half", "METADE"],
  ["many", "MUITOS"],
  ["almost_all", "QUASE TODOS"],
  ["all", "TODOS"]
];

const SCENE_ZERO_INDEX = [
  ["scene-zero-boot", "BOOT"],
  ["scene-zero-sound-check", "ESCUTA DE DECIBÉIS"],
  ["scene-zero-unlock", "ESQUENTAR PÚBLICO"],
  ["scene-zero-participant", "ESCOLHER PARTICIPANTE"],
  ["scene-zero-suitcases", "JOGO DAS MALAS"],
  ["scene-zero-extras", "OUTROS"]
];

function remainingTimer(timer, now, fallback = 15) {
  if (timer?.status === "running" && timer.endsAt) {
    return Math.max(0, Math.ceil((Date.parse(timer.endsAt) - now) / 1000));
  }
  return timer?.remainingSeconds ?? fallback;
}

const CONTROLLER_MICROPHONE_SESSION_KEY = "__caixaPretaControllerMicrophone";

function controllerMicrophoneSession() {
  if (typeof window === "undefined") return null;
  if (!window[CONTROLLER_MICROPHONE_SESSION_KEY]) {
    window[CONTROLLER_MICROPHONE_SESSION_KEY] = {
      analyser: null,
      context: null,
      request: null,
      source: null,
      stream: null
    };
  }
  return window[CONTROLLER_MICROPHONE_SESSION_KEY];
}

function hasLiveAudioTrack(stream) {
  return Boolean(stream?.getAudioTracks().some((track) => track.readyState === "live"));
}

function suitcaseAdvanceToken(game = {}) {
  return [
    game.status || "idle",
    Number(game.suitcaseSelectionSequence || 0),
    game.cuePhase || "idle",
    game.choice?.status || "idle",
    game.choice?.messageId || "",
    Number(game.choice?.sequence || 0),
    game.contentInstruction?.status || "idle",
    game.contentInstruction?.messageId || "",
    Number(game.contentInstruction?.stepIndex ?? -1),
    game.gincana?.timer?.status || "idle",
    game.gincana?.retry?.status || "idle",
    game.hangman?.status || "idle",
    game.hangman?.retry?.status || "idle"
  ].join("|");
}

export default function SceneZeroController() {
  const [snapshot, setSnapshot] = useState({ sceneZero: null, audienceWarmup: null, instagram: null, game: null, suitcase: null, glitch: null, memories: [] });
  const [pending, setPending] = useState("");
  const [detail, setDetail] = useState("");
  const [manualBotInstruction, setManualBotInstruction] = useState("");
  const [manualUserInstruction, setManualUserInstruction] = useState("");
  const [manualInstructionPending, setManualInstructionPending] = useState(false);
  const [memoryText, setMemoryText] = useState("");
  const [collectionObservation, setCollectionObservation] = useState("");
  const [selectedHangmanWordId, setSelectedHangmanWordId] = useState(SCENE_ZERO_HANGMAN_WORDS[0]?.id || "");
  const [hangmanGuess, setHangmanGuess] = useState("");
  const [personalityGuidance, setPersonalityGuidance] = useState("");
  const [personalityGuidanceDirty, setPersonalityGuidanceDirty] = useState(false);
  const [browserCommand, setBrowserCommand] = useState("");
  const [googleGuidance, setGoogleGuidance] = useState("");
  const [instagramGuidance, setInstagramGuidance] = useState("");
  const [instagramPanelClosed, setInstagramPanelClosed] = useState(false);
  const [glitchVideos, setGlitchVideos] = useState([]);
  const [glitchVideoFile, setGlitchVideoFile] = useState("");
  const [glitchVideoLoop, setGlitchVideoLoop] = useState(false);
  const [glitchVideoTransitionSeconds, setGlitchVideoTransitionSeconds] = useState(5.2);
  const [activeIndexSection, setActiveIndexSection] = useState("scene-zero-boot");
  const [warmupOpen, setWarmupOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [openSuitcaseControls, setOpenSuitcaseControls] = useState(null);
  const [notice, setNotice] = useState("SISTEMA PRONTO");
  const [microphonePermission, setMicrophonePermission] = useState("requesting");
  const [now, setNow] = useState(Date.now());
  const teaAudioRef = useRef(null);
  const microphoneRequestRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const microphoneContextRef = useRef(null);
  const microphoneSourceRef = useRef(null);
  const microphoneAnalyserRef = useRef(null);
  const soundCheckLevelRequestRef = useRef(null);
  const controllerActionPendingRef = useRef(false);
  const suitcaseAdvanceLockRef = useRef("");
  const currentSuitcaseAdvanceToken = suitcaseAdvanceToken(snapshot.sceneZero?.suitcaseGame);

  const prepareMicrophone = useCallback(async () => {
    const session = controllerMicrophoneSession();
    if (!session) return false;

    function attachSession() {
      microphoneStreamRef.current = session.stream;
      microphoneContextRef.current = session.context;
      microphoneSourceRef.current = session.source;
      microphoneAnalyserRef.current = session.analyser;
    }

    if (hasLiveAudioTrack(session.stream) && session.analyser) {
      attachSession();
      setMicrophonePermission(session.context?.state === "running" ? "ready" : "suspended");
      return true;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicrophonePermission(window.isSecureContext ? "unavailable" : "insecure");
      return false;
    }

    setMicrophonePermission("requesting");
    if (!session.request) {
      session.request = (async () => {
        let stream = hasLiveAudioTrack(session.stream) ? session.stream : null;
        let context = null;
        try {
          if (!stream) {
            stream = await navigator.mediaDevices.getUserMedia({
              // Preserve the browser's original microphone processing so output
              // from the bot is treated as echo instead of audience input.
              audio: true,
              video: false
            });
          }
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) throw new Error("AUDIO_CONTEXT_UNAVAILABLE");
          context = new AudioContext();
          const source = context.createMediaStreamSource(stream);
          const analyser = context.createAnalyser();
          analyser.fftSize = 1024;
          analyser.smoothingTimeConstant = 0.82;
          source.connect(analyser);
          session.stream = stream;
          session.context = context;
          session.source = source;
          session.analyser = analyser;
          return true;
        } catch (error) {
          stream?.getTracks().forEach((track) => track.stop());
          context?.close().catch(() => {});
          session.stream = null;
          session.context = null;
          session.source = null;
          session.analyser = null;
          throw error;
        } finally {
          session.request = null;
        }
      })();
    }

    microphoneRequestRef.current = session.request;
    try {
      await session.request;
      attachSession();
      setMicrophonePermission(session.context?.state === "running" ? "ready" : "suspended");
      return true;
    } catch (error) {
      setMicrophonePermission(error?.name === "NotAllowedError" ? "blocked" : "unavailable");
      return false;
    } finally {
      microphoneRequestRef.current = null;
    }
  }, []);

  const activateMicrophone = useCallback(async () => {
    const prepared = await prepareMicrophone();
    if (!prepared) return false;
    const context = microphoneContextRef.current;
    if (!context) return false;
    try {
      if (context.state !== "running") await context.resume();
    } catch {
      setMicrophonePermission("unavailable");
      return false;
    }
    const active = context.state === "running";
    setMicrophonePermission(active ? "ready" : "suspended");
    return active;
  }, [prepareMicrophone]);

  const warmupAction = useCallback(async (action, payload = {}) => {
    if (pending || controllerActionPendingRef.current) return null;
    controllerActionPendingRef.current = true;
    setPending(action);
    try {
      const response = await fetch("/api/audience-warmup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ERRO NO AQUECIMENTO");
      if (data.audienceWarmup || data.unlock) {
        setSnapshot((current) => ({
          ...current,
          ...(data.audienceWarmup ? { audienceWarmup: data.audienceWarmup } : {}),
          ...(data.unlock ? { sceneZero: { ...current.sceneZero, unlock: data.unlock } } : {})
        }));
      }
      setNotice(data.message || action.toUpperCase());
      return data;
    } catch (error) {
      setNotice(error.message);
      return null;
    } finally {
      controllerActionPendingRef.current = false;
      setPending("");
    }
  }, [pending]);

  const sceneAction = useCallback(async (action, payload = {}) => {
    if (pending || controllerActionPendingRef.current) return null;
    controllerActionPendingRef.current = true;
    setPending(action);
    setNotice(`PROCESSANDO ${action.toUpperCase()}...`);
    try {
      const response = await fetch("/api/scene-zero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, detail, ...payload })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ERRO CENA 0");
      if (data.sceneZero || data.audienceWarmup) {
        setSnapshot((current) => ({
          ...current,
          ...(data.sceneZero ? { sceneZero: data.sceneZero } : {}),
          ...(data.audienceWarmup ? { audienceWarmup: data.audienceWarmup } : {})
        }));
      }
      setNotice(data.message || action.toUpperCase());
      setDetail("");
      return data;
    } catch (error) {
      setNotice(error.message);
      return null;
    } finally {
      controllerActionPendingRef.current = false;
      setPending("");
    }
  }, [detail, pending]);

  const runSuitcaseAdvance = useCallback((action, payload = {}) => {
    if (suitcaseAdvanceLockRef.current === currentSuitcaseAdvanceToken) return Promise.resolve(null);
    suitcaseAdvanceLockRef.current = currentSuitcaseAdvanceToken;
    return sceneAction(action, payload).then((result) => {
      if (!result) suitcaseAdvanceLockRef.current = "";
      return result;
    });
  }, [currentSuitcaseAdvanceToken, sceneAction]);

  useEffect(() => {
    if (suitcaseAdvanceLockRef.current && suitcaseAdvanceLockRef.current !== currentSuitcaseAdvanceToken) {
      suitcaseAdvanceLockRef.current = "";
    }
  }, [currentSuitcaseAdvanceToken]);

  useEffect(() => {
    fetch("/api/state").then((response) => response.json()).then(setSnapshot).catch(() => setNotice("SEM CONEXÃO"));
    fetch("/api/glitch")
      .then((response) => response.json())
      .then((data) => {
        const videos = data.videos || [];
        setGlitchVideos(videos);
        setGlitchVideoFile(data.glitch?.video?.file || videos[0]?.file || "");
        setGlitchVideoLoop(Boolean(data.glitch?.video?.loop));
        setGlitchVideoTransitionSeconds(Number(((data.glitch?.video?.transitionMs || 5200) / 1000).toFixed(1)));
      })
      .catch(() => setNotice("VÍDEOS DE GLITCH INDISPONÍVEIS"));
    const events = new EventSource("/api/events?client=scene-zero-controller");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setSnapshot(payload.state || {});
    };
    events.onerror = () => setNotice("SSE DESCONECTADO");
    return () => events.close();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => robotSoundEngine.armAutoUnlock(), []);

  useEffect(() => robotSoundEngine.armAudioRelay({ sink: true }), []);

  useEffect(() => {
    if (snapshot.robotSound) robotSoundEngine.setSettings(snapshot.robotSound);
  }, [snapshot.robotSound]);

  useEffect(() => {
    prepareMicrophone();
  }, [prepareMicrophone]);

  useEffect(() => {
    function resumeMicrophoneFromOperatorGesture() {
      const context = microphoneContextRef.current;
      if (!context || context.state === "running") return;
      context.resume()
        .then(() => setMicrophonePermission(context.state === "running" ? "ready" : "suspended"))
        .catch(() => setMicrophonePermission("unavailable"));
    }
    window.addEventListener("pointerdown", resumeMicrophoneFromOperatorGesture, true);
    window.addEventListener("keydown", resumeMicrophoneFromOperatorGesture, true);
    return () => {
      window.removeEventListener("pointerdown", resumeMicrophoneFromOperatorGesture, true);
      window.removeEventListener("keydown", resumeMicrophoneFromOperatorGesture, true);
    };
  }, []);

  useEffect(() => {
    function releaseMicrophone() {
      const session = controllerMicrophoneSession();
      session?.stream?.getTracks().forEach((track) => track.stop());
      session?.context?.close().catch(() => {});
      if (session) {
        session.stream = null;
        session.context = null;
        session.source = null;
        session.analyser = null;
        session.request = null;
      }
      microphoneStreamRef.current = null;
      microphoneContextRef.current = null;
      microphoneSourceRef.current = null;
      microphoneAnalyserRef.current = null;
    }
    window.addEventListener("pagehide", releaseMicrophone);
    return () => window.removeEventListener("pagehide", releaseMicrophone);
  }, []);

  const activeSoundCheckPhase = snapshot.sceneZero?.unlock?.soundCheck?.phase;
  const activeSoundCheckSequence = snapshot.sceneZero?.unlock?.soundCheck?.sequence;
  const microphoneSensitivity = robotMicrophoneSensitivity(snapshot.robotSound);

  useEffect(() => {
    if (activeSoundCheckPhase !== "listening") return undefined;

    let cancelled = false;
    let frame = 0;
    let smoothedLevel = 0;
    let heldMs = 0;
    let lastFrameAt = performance.now();
    let lastPublishAt = 0;
    let completionSent = false;

    function publishLevel(level, holdProgress, status = "listening") {
      if (soundCheckLevelRequestRef.current) return;
      const request = fetch("/api/audience-warmup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlock-sound-check-level",
          automatic: true,
          level: Math.round(level * 100),
          holdProgress: Math.round(holdProgress * 100),
          microphoneStatus: status
        })
      }).catch(() => null).finally(() => {
        if (soundCheckLevelRequestRef.current === request) soundCheckLevelRequestRef.current = null;
      });
      soundCheckLevelRequestRef.current = request;
    }

    async function completeFromMicrophone(detectedLevel) {
      completionSent = true;
      try {
        const response = await fetch("/api/audience-warmup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "unlock-sound-check-complete",
            automatic: true,
            detectedLevel: Math.round(detectedLevel * 100)
          })
        });
        if (!response.ok) throw new Error("SOUND CHECK COMPLETION FAILED");
      } catch {
        if (!cancelled) completionSent = false;
      }
    }

    if (["blocked", "insecure", "unavailable"].includes(microphonePermission) || !microphoneAnalyserRef.current) {
      if (microphonePermission !== "requesting") publishLevel(0, 0, "unavailable");
      return () => { cancelled = true; };
    }

    microphoneContextRef.current?.resume()
      .then(() => setMicrophonePermission(microphoneContextRef.current?.state === "running" ? "ready" : "suspended"))
      .catch(() => setMicrophonePermission("unavailable"));
    const analyser = microphoneAnalyserRef.current;
    const samples = new Uint8Array(analyser.fftSize);
    const threshold = PLAY_UNLOCK_CONFIG.soundCheck.thresholdPercent / 100;

    const readLevel = (frameAt) => {
      if (cancelled) return;
      analyser.getByteTimeDomainData(samples);
      let energy = 0;
      for (const sample of samples) {
        const amplitude = (sample - 128) / 128;
        energy += amplitude * amplitude;
      }
      const rms = Math.sqrt(energy / samples.length);
      // Medidor teatral sensível a voz/palmas; não pretende representar dB científicos.
      const normalized = Math.max(0, Math.min(1, ((rms - 0.006) / 0.055) * microphoneSensitivity));
      smoothedLevel = (smoothedLevel * 0.82) + (normalized * 0.18);
      const elapsed = Math.min(80, frameAt - lastFrameAt);
      lastFrameAt = frameAt;
      heldMs = smoothedLevel >= threshold
        ? Math.min(PLAY_UNLOCK_CONFIG.soundCheck.sustainMs, heldMs + elapsed)
        : Math.max(0, heldMs - (elapsed * 1.5));
      const holdProgress = heldMs / PLAY_UNLOCK_CONFIG.soundCheck.sustainMs;

      if (frameAt - lastPublishAt >= 100) {
        lastPublishAt = frameAt;
        publishLevel(smoothedLevel, holdProgress);
      }
      if (!completionSent && holdProgress >= 1) {
        publishLevel(1, 1);
        completeFromMicrophone(smoothedLevel);
      }
      frame = window.requestAnimationFrame(readLevel);
    };
    frame = window.requestAnimationFrame(readLevel);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [activeSoundCheckPhase, activeSoundCheckSequence, microphonePermission, microphoneSensitivity]);

  useEffect(() => {
    function handleStageArrow(event) {
      const spacePressed = event.code === "Space" || event.key === " " || event.key === "Spacebar";
      if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(event.key) && !spacePressed) return;
      if (pending) return;
      const target = event.target;
      const inputEditsWithArrow = target?.tagName === "INPUT" && !["checkbox", "button"].includes(target.type);
      const editable = target?.isContentEditable || ["TEXTAREA", "SELECT"].includes(target?.tagName) || inputEditsWithArrow;
      if (editable || event.repeat) return;
      if (spacePressed) {
        if (target?.closest?.("input, [role='checkbox']")) return;
        const unlock = snapshot.sceneZero?.unlock;
        const warmup = snapshot.audienceWarmup;
        const action = unlock?.status === "BOOT_FAILED" && !unlock.bootComplete
          ? "unlock-end-bios"
          : warmup?.phase === "questions"
            ? "questions-complete"
            : warmup?.minigame?.status === "ready_for_draw"
              ? "minigame-draw"
            : warmup?.phase === "minigame" && warmup.minigame?.selectedId
              && ["running", "paused", "exchange", "ready_round_two"].includes(warmup.minigame.status)
              ? "minigame-end"
              : null;
        if (!action) return;
        event.preventDefault();
        warmupAction(action);
        return;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        const warmup = snapshot.audienceWarmup;
        const prompt = AUDIENCE_WARMUP_PROMPTS.find((candidate) => candidate.id === warmup?.sequence?.promptId);
        if (warmup?.phase !== "questions" || !prompt) return;
        const kind = event.key === "ArrowUp" ? "many" : "few";
        const option = audienceWarmupResponseOptions(prompt.action).find((response) => response.kind === kind);
        if (!option) return;
        event.preventDefault();
        warmupAction("record-response", option);
        return;
      }
      const bootStatus = snapshot.sceneZero?.unlock?.status;
      const stage = snapshot.sceneZero?.stage;
      if (event.key === "ArrowLeft") {
        const previous = stage === "suitcases"
          ? ["set-stage", { stage: "participant" }]
          : stage === "participant"
            ? ["return-to-warmup"]
            : bootStatus === "STANDBY"
              ? null
              : bootStatus === "BOOTING" || (bootStatus === "BOOT_FAILED" && !snapshot.sceneZero?.unlock?.bootComplete)
                ? Number(snapshot.sceneZero?.unlock?.bootStep) > 0
                  ? ["rewind-boot"]
                  : ["return-to-boot"]
                : bootStatus === "SOUND_CHECK" || bootStatus === "BOOT_FAILED"
                  ? ["return-to-boot"]
                  : ["return-to-sound-check"];
        if (!previous) return;
        event.preventDefault();
        if (previous[0] === "rewind-boot") warmupAction("unlock-rewind-boot");
        else sceneAction(previous[0], previous[1] || {});
        return;
      }
      if (stage === "participant") {
        const participantStatus = snapshot.sceneZero?.participantSelection?.status;
        if (participantStatus === "ready_countdown" && snapshot.audienceWarmup?.manualMode) {
          event.preventDefault();
          sceneAction("participant-countdown-start", { sequence: snapshot.sceneZero.participantSelection.sequence });
          return;
        }
        if (participantStatus === "selected" && snapshot.audienceWarmup?.manualMode) {
          event.preventDefault();
          sceneAction("participant-continue", { sequence: snapshot.sceneZero.participantSelection.sequence });
          return;
        }
        if (participantStatus !== "complete" || !snapshot.sceneZero?.currentParticipant?.name) return;
        event.preventDefault();
        sceneAction("set-stage", { stage: "suitcases" });
        return;
      }
      if (stage === "suitcases") {
        const game = snapshot.sceneZero?.suitcaseGame;
        const choiceStatus = game?.choice?.status || "idle";
        const finalInstructionReady = game?.currentSuitcase === 1
          && !nextSceneZeroSuitcase(game)
          && game.contentInstruction?.kind === "last-suitcase"
          && game.contentInstruction?.status === "complete"
          && game.contentInstruction?.selectionSequence === game.suitcaseSelectionSequence;
        const suitcaseInstructionWaiting = game?.contentInstruction?.status === "ready";
        const suitcaseInstructionBusy = ["announcing", "ready"].includes(game?.contentInstruction?.status);
        const emergenceWaiting = choiceStatus === "emergence_ready";
        const preDrawHangmanWaitingToStart = choiceStatus === "challenge_ready";
        const preDrawHangmanWaitingToDraw = ["challenge_result", "challenge_complete"].includes(choiceStatus)
          && game?.hangman?.status === "won";
        const gincanaRetryWaiting = game?.gincana?.retry?.status === "ready";
        const hangmanRetryWaiting = game?.hangman?.retry?.status === "ready";
        const suitcaseActivityBusy = suitcaseInstructionBusy || (game?.currentSuitcase === 2
          ? game.gincana?.result === "failed"
            || ["running", "paused"].includes(game.gincana?.timer?.status)
            || ["announcing", "ready"].includes(game.gincana?.retry?.status)
          : game?.currentSuitcase === 3
            && (["theme-drawing", "ready", "active", "retry_wait"].includes(game.hangman?.status) || hangmanRetryWaiting));
        const action = choiceStatus === "ready"
          ? "suitcase-choice-continue"
          : emergenceWaiting
            ? "suitcase-emergence-continue"
          : choiceStatus === "briefing_ready"
            ? "suitcase-briefing-continue"
          : preDrawHangmanWaitingToStart
            ? "suitcase-predraw-hangman-start"
          : preDrawHangmanWaitingToDraw
            ? "suitcase-predraw-continue"
          : gincanaRetryWaiting
            ? "gincana-retry-start"
          : hangmanRetryWaiting
            ? "hangman-retry-start"
          : choiceStatus !== "idle"
            ? null
            : game?.cuePhase === "selected"
              ? "suitcase-cue-open"
              : game?.cuePhase === "open"
                ? "suitcase-cue-continue"
                : game?.cuePhase === "drawing"
                  ? null
            : suitcaseInstructionWaiting
              ? "suitcase-content-instruction-continue"
            : suitcaseActivityBusy
              ? null
            : game?.currentSuitcase === 2 && game.gincana?.currentTask && game.gincana?.timer?.status === "idle"
              && game.contentInstruction?.status === "complete"
              ? "gincana-timer-start"
              : game?.currentSuitcase === 3 && game.hangman?.status === "ready"
                ? null
            : game?.currentSuitcase && nextSceneZeroSuitcase(game)
                  ? "suitcase-next"
                  : finalInstructionReady
                    ? "suitcase-finish"
                  : null;
        if (!action) return;
        event.preventDefault();
        runSuitcaseAdvance(action, ["suitcase-cue-open", "suitcase-cue-continue"].includes(action)
          ? { selectionSequence: game.suitcaseSelectionSequence }
          : {});
        return;
      }
      if (stage === "idle" && snapshot.audienceWarmup?.phase === "complete") {
        event.preventDefault();
        sceneAction("set-stage", { stage: "participant" });
        return;
      }
      const action = bootStatus === "STANDBY"
        ? "unlock-boot"
        : bootStatus === "BOOTING"
          ? "unlock-advance-boot"
          : bootStatus === "BOOT_FAILED" && !snapshot.sceneZero?.unlock?.bootComplete
            ? "unlock-end-bios"
            : snapshot.audienceWarmup?.minigame?.status === "ready_for_draw"
              ? "minigame-draw"
            : snapshot.audienceWarmup?.minigame?.status === "paused"
              ? "minigame-resume"
            : Boolean(snapshot.audienceWarmup?.pendingAdvance) || snapshot.audienceWarmup?.phase === "questions"
              ? "primary-next"
              : ["ready", "ready_round_two"].includes(snapshot.audienceWarmup?.minigame?.status)
                ? "minigame-start"
              : null;
      if (!action) return;
      event.preventDefault();
      warmupAction(action);
    }
    window.addEventListener("keydown", handleStageArrow);
    return () => window.removeEventListener("keydown", handleStageArrow);
  }, [pending, runSuitcaseAdvance, sceneAction, snapshot.audienceWarmup, snapshot.sceneZero?.currentParticipant?.name, snapshot.sceneZero?.participantSelection?.sequence, snapshot.sceneZero?.participantSelection?.status, snapshot.sceneZero?.stage, snapshot.sceneZero?.suitcaseGame, snapshot.sceneZero?.unlock, warmupAction]);

  useEffect(() => {
    const activeSuitcase = snapshot.sceneZero?.suitcaseGame?.currentSuitcase;
    setOpenSuitcaseControls([1, 2, 3].includes(activeSuitcase) ? activeSuitcase : null);
  }, [snapshot.sceneZero?.suitcaseGame?.currentSuitcase]);

  useEffect(() => {
    const currentWordId = snapshot.sceneZero?.suitcaseGame?.hangman?.wordId;
    if (currentWordId) setSelectedHangmanWordId(currentWordId);
  }, [snapshot.sceneZero?.suitcaseGame?.hangman?.wordId]);

  useEffect(() => {
    if (snapshot.instagram?.embeddedPanelSequence > 0) {
      setInstagramPanelClosed(false);
    }
  }, [snapshot.instagram?.embeddedPanelSequence]);

  useEffect(() => {
    if (snapshot.instagram?.embeddedPanelVisible === false) setInstagramPanelClosed(true);
    if (snapshot.instagram?.embeddedPanelVisible === true) setInstagramPanelClosed(false);
  }, [snapshot.instagram?.embeddedPanelVisible]);

  const browserProcessing = ["STARTING", "NAVIGATING", "ACTING"].includes(snapshot.instagram?.status);
  const informationProcessing = Boolean(pending) || browserProcessing;

  useEffect(() => {
    if (informationProcessing) robotSoundEngine.startThinking();
    else robotSoundEngine.stopThinking();
    return () => robotSoundEngine.stopThinking();
  }, [informationProcessing]);

  useEffect(() => {
    if (!personalityGuidanceDirty) {
      setPersonalityGuidance(snapshot.sceneZero?.personalityGuidance?.text || "");
    }
  }, [snapshot.sceneZero?.personalityGuidance?.text, personalityGuidanceDirty]);

  useEffect(() => {
    const sections = SCENE_ZERO_INDEX
      .map(([id]) => document.getElementById(id))
      .filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio || a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]?.target?.id) setActiveIndexSection(visible[0].target.id);
    }, {
      rootMargin: "-8% 0px -68% 0px",
      threshold: [0, 0.05, 0.2, 0.5]
    });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  async function bootScene() {
    if (pending || sceneZero.unlock?.status !== "STANDBY") return;
    setPending("unlock-boot");
    setNotice("INICIANDO BIOS...");
    try {
      const response = await fetch("/api/audience-warmup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock-boot" })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ERRO AO INICIAR BIOS");
      if (data.unlock) {
        setSnapshot((current) => ({
          ...current,
          sceneZero: { ...current.sceneZero, unlock: data.unlock }
        }));
      }
      setNotice(data.message || "BIOS INICIADA");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setPending("");
    }
  }

  async function operatorCommand(command) {
    if (pending) return null;
    setPending(command);
    try {
      const response = await fetch("/api/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ERRO OPERATOR");
      setNotice(data.message || command);
      return data;
    } catch (error) {
      setNotice(error.message);
      return null;
    } finally {
      setPending("");
    }
  }

  async function stopReels() {
    try {
      const response = await fetch("/api/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "/instagram reels-parar" })
      });
      const data = await response.json();
      setNotice(response.ok ? data.message : data.error || "ERRO AO PARAR REELS");
    } catch {
      setNotice("ERRO AO PARAR REELS");
    }
  }

  async function copyInstagramPassword() {
    if (pending) return;
    setPending("instagram-copy-password");
    setNotice("COPIANDO SENHA DO INSTAGRAM...");

    try {
      const response = await fetch("/api/instagram/password", {
        method: "POST",
        cache: "no-store",
        headers: { "X-Caixa-Preta-Operator": "scene-zero" }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "SENHA DO INSTAGRAM INDISPONÍVEL");
      setNotice("SENHA DO INSTAGRAM COPIADA");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setPending("");
    }
  }

  async function updateInstagramPanelVisibility(visible) {
    setInstagramPanelClosed(!visible);
    try {
      await setSharedInstagramPanelVisible(visible);
      setNotice(visible ? "PAINEL DO INSTAGRAM EXIBIDO" : "PAINEL DO INSTAGRAM OCULTADO NO OPERATOR E NO PÚBLICO");
    } catch (error) {
      setInstagramPanelClosed(visible);
      setNotice(error.message);
    }
  }

  async function addMemory() {
    const content = memoryText.trim();
    if (!content) return;
    const stored = await operatorCommand(`/memory ${content}`);
    if (stored) setMemoryText("");
  }

  async function glitchVideoAction(action) {
    if (pending) return;
    const transitionSeconds = Math.min(30, Math.max(0.6, Number(glitchVideoTransitionSeconds) || 5.2));
    setGlitchVideoTransitionSeconds(transitionSeconds);
    setPending(action);
    setNotice(`PROCESSANDO ${action.toUpperCase()}...`);
    try {
      const response = await fetch("/api/glitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          payload: {
            file: glitchVideoFile,
            loop: glitchVideoLoop,
            preset: "video",
            transitionMs: Math.round(transitionSeconds * 1000)
          }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ERRO GLITCH + VÍDEO");
      if (data.state) setSnapshot((current) => ({ ...current, glitch: data.state }));
      if (data.videos) setGlitchVideos(data.videos);
      setNotice(action === "video" ? "GLITCH + VÍDEO ATIVO" : "VÍDEO ENCERRADO / BOT RESTAURADO");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setPending("");
    }
  }

  function teaAction(action) {
    const audio = teaAudioRef.current;
    if (audio) {
      if (action === "tea-stop") {
        audio.pause();
        audio.currentTime = 0;
      } else {
        audio.currentTime = 0;
        audio.play().catch(() => setNotice("ÁUDIO BLOQUEADO PELO NAVEGADOR"));
      }
    }
    sceneAction(action);
  }

  async function recordCollectionResult(result, estimatedCount = null) {
    const recorded = await sceneAction("collection-record-result", {
      result,
      estimatedCount,
      observation: collectionObservation
    });
    if (recorded) setCollectionObservation("");
  }

  async function sendManualInstruction(target) {
    const instruction = (target === "bot" ? manualBotInstruction : manualUserInstruction).trim();
    if (!instruction || manualInstructionPending) return;
    setManualInstructionPending(true);
    setNotice("PROCESSANDO INSTRUÇÃO AVULSA...");
    try {
      const response = await fetch("/api/scene-zero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suitcase-manual-instruction", instruction, target })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ERRO AO ENVIAR INSTRUÇÃO AVULSA");
      if (data.sceneZero) setSnapshot((current) => ({ ...current, sceneZero: data.sceneZero }));
      if (target === "bot") setManualBotInstruction("");
      else setManualUserInstruction("");
      setNotice(data.message || "INSTRUÇÃO AVULSA EXIBIDA");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setManualInstructionPending(false);
    }
  }

  async function savePersonalityGuidance(guidance) {
    const saved = await sceneAction("set-personality-guidance", { guidance });
    if (saved) setPersonalityGuidanceDirty(false);
  }

  async function togglePersonalityDirection(direction) {
    const current = sceneZero.personalityGuidance?.quickDirections || [];
    const active = current.includes(direction.id);
    const sameCategoryIds = new Set(
      SCENE_ZERO_PERSONALITY_DIRECTIONS
        .filter((candidate) => candidate.category === direction.category)
        .map((candidate) => candidate.id)
    );
    const withoutCategory = current.filter((id) => !sameCategoryIds.has(id));
    const quickDirections = active ? withoutCategory : [...withoutCategory, direction.id];
    await sceneAction("set-personality-guidance", { quickDirections });
  }

  async function clearPersonalityGuidance() {
    setPersonalityGuidance("");
    const cleared = await sceneAction("set-personality-guidance", { guidance: "", quickDirections: [] });
    if (cleared) setPersonalityGuidanceDirty(false);
  }

  const sceneZero = snapshot.sceneZero || {};
  const audienceWarmup = snapshot.audienceWarmup || {};
  const manualMode = Boolean(audienceWarmup.manualMode);
  const activeWarmupPrompt = AUDIENCE_WARMUP_PROMPTS.find((prompt) => prompt.id === audienceWarmup.sequence?.promptId) || null;
  const responseOptions = audienceWarmupResponseOptions(activeWarmupPrompt?.action);
  const reactionControlsActive = audienceWarmup.phase === "questions" && Boolean(activeWarmupPrompt);
  const unlockStatusLabel = sceneZero.unlock?.status === "BOOT_FAILED"
    ? "AGUARDANDO INÍCIO MANUAL"
    : (sceneZero.unlock?.status || "STANDBY").replaceAll("_", " ");
  const collection = sceneZero.collection || {};
  const timer = sceneZero.timer || {};
  const seconds = remainingTimer(timer, now);
  const instagram = snapshot.instagram || {};
  const instagramLoginVerified = instagram.sessionAuthenticated === true;
  const suitcase = snapshot.suitcase || {};
  const suitcaseGame = sceneZero.suitcaseGame || {};
  const suitcaseChoice = suitcaseGame.choice || {};
  const suitcaseContentInstruction = suitcaseGame.contentInstruction || {};
  const suitcaseCuePhase = suitcaseGame.cuePhase || "idle";
  const gincana = suitcaseGame.gincana || {};
  const gincanaTimer = gincana.timer || {};
  const gincanaSoundtrack = gincana.soundtrack || {};
  const gincanaSeconds = remainingTimer(gincanaTimer, now, null);
  const hangman = suitcaseGame.hangman || {};
  const hangmanPublic = hangman.activity?.publicState || {};
  const hangmanUsed = new Set((hangmanPublic.usedGuesses || []).map((guess) => `${guess}`.toUpperCase()));
  const hangmanActive = hangman.status === "active";
  const hangmanSeconds = remainingTimer(hangman.timer || {}, now, 60);
  const nextSuitcase = nextSceneZeroSuitcase(suitcaseGame);
  const finalInstructionReady = suitcaseGame.currentSuitcase === 1
    && !nextSuitcase
    && suitcaseContentInstruction.kind === "last-suitcase"
    && suitcaseContentInstruction.status === "complete"
    && suitcaseContentInstruction.selectionSequence === suitcaseGame.suitcaseSelectionSequence;
  const suitcaseInstructionWaiting = suitcaseContentInstruction.status === "ready";
  const suitcaseInstructionBusy = ["announcing", "ready"].includes(suitcaseContentInstruction.status);
  const emergenceWaiting = suitcaseChoice.status === "emergence_ready";
  const preDrawHangmanWaitingToStart = suitcaseChoice.status === "challenge_ready";
  const preDrawHangmanWaitingToDraw = ["challenge_result", "challenge_complete"].includes(suitcaseChoice.status)
    && hangman.status === "won";
  const preDrawHangmanBusy = ["challenge_preparing", "challenge_instruction", "challenge_ready", "challenge", "challenge_result", "challenge_complete"].includes(suitcaseChoice.status);
  const preDrawHangmanActive = suitcaseChoice.targetSuitcase === 3 && preDrawHangmanBusy;
  const gincanaRetryWaiting = gincana.retry?.status === "ready";
  const hangmanRetryWaiting = hangman.retry?.status === "ready";
  const suitcaseActivityBusy = suitcaseInstructionBusy || (suitcaseGame.currentSuitcase === 2
    ? gincana.result === "failed"
      || ["running", "paused"].includes(gincanaTimer.status)
      || ["announcing", "ready"].includes(gincana.retry?.status)
    : suitcaseGame.currentSuitcase === 3
      && (["theme-drawing", "ready", "active", "retry_wait"].includes(hangman.status) || hangmanRetryWaiting));
  const morelBios = suitcaseGame.morelBios || {};
  const morelBiosRunning = morelBios.status === "running";
  const morelBiosBlackout = morelBiosRunning && Date.parse(morelBios.endsAt || "") <= now;
  const globalGlitch = snapshot.glitch || {};
  const participantSelection = sceneZero.participantSelection || {};
  const participantSelectionBusy = ["preparing", "awaiting_invite", "ready_countdown", "countdown", "roulette", "selected", "post_selection"].includes(participantSelection.status);
  const participantCountdown = participantSelection.status === "countdown"
    ? countdownSeconds(participantSelection.countdownEndsAt, now)
    : null;
  const questions = useMemo(() => [...(collection.questions || [])].reverse(), [collection.questions]);
  const latestMemories = useMemo(() => [...(snapshot.memories || [])].slice(-5).reverse(), [snapshot.memories]);

  async function navigateToSection(event, id) {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveIndexSection(id);
    if (id === "scene-zero-boot" && sceneZero.unlock?.status !== "STANDBY") {
      await sceneAction("return-to-boot");
      return;
    }
    if (id === "scene-zero-sound-check") {
      if (!sceneZero.unlock?.bootComplete) {
        setNotice("ENCERRE A BIOS ANTES DE RETOMAR A ESCUTA");
        return;
      }
      await sceneAction("return-to-sound-check");
      return;
    }
    if (id === "scene-zero-unlock") {
      setWarmupOpen(true);
      const alreadyInWarmupQuestions = sceneZero.stage === "idle" && audienceWarmup.phase === "questions";
      const canReturnToWarmup = sceneZero.stage !== "idle" || [
        "WAITING_FOR_AUDIENCE",
        "WARMING_AUDIENCE",
        "UNLOCKING",
        "UNLOCKED"
      ].includes(sceneZero.unlock?.status);
      if (!alreadyInWarmupQuestions && canReturnToWarmup) await sceneAction("return-to-warmup");
      return;
    }
    if (id === "scene-zero-participant" && sceneZero.stage !== "participant") {
      await sceneAction("set-stage", { stage: "participant" });
      return;
    }
    if (id === "scene-zero-suitcases" && sceneZero.stage !== "suitcases") {
      await sceneAction("set-stage", { stage: "suitcases" });
    }
  }

  async function callAttention() {
    const unlocked = await robotSoundEngine.unlock();
    if (!unlocked) {
      setNotice("ÁUDIO BLOQUEADO · INTERAJA COM A JANELA E TENTE NOVAMENTE");
      return;
    }
    robotSoundEngine.attention();
    setNotice("SINAL DE ATENÇÃO DISPARADO");
  }

  return (
    <main className={styles.controller}>
      <audio
        preload="auto"
        ref={teaAudioRef}
        src="/api/game-assets?file=audios%2FDoris%20Day%20-%20Tea%20For%20Two%20(1950).mp3"
      />
      <section className={styles.operatorModeBar} data-active={manualMode ? "true" : "false"} aria-label="Controles iniciais do aquecimento">
        <label>
          <input
            checked={manualMode}
            disabled={Boolean(pending)}
            onChange={(event) => warmupAction("set-manual-mode", { manualMode: event.target.checked })}
            type="checkbox"
          />
          <span><strong>MODO MANUAL</strong><small>{manualMode ? "ATIVO · → AVANÇA · ← VOLTA · ESPAÇO ENCERRA" : "DESLIGADO · → AVANÇA · ← VOLTA · ESPAÇO ENCERRA"}</small></span>
        </label>
        <div className={styles.microphonePermission} data-status={microphonePermission}>
          <span>MICROFONE</span>
          <strong>{microphonePermission === "ready"
            ? `ATIVO${activeSoundCheckPhase === "listening" ? ` · NÍVEL ${Math.round(Number(sceneZero.unlock?.soundCheck?.liveLevel) || 0)}%` : ""}`
            : microphonePermission === "requesting"
              ? "SOLICITANDO PERMISSÃO..."
              : microphonePermission === "suspended"
                ? "AUTORIZADO · AGUARDANDO ATIVAÇÃO"
              : microphonePermission === "blocked"
                ? "PERMISSÃO BLOQUEADA"
                : microphonePermission === "insecure"
                  ? "EXIGE HTTPS OU LOCALHOST"
                : "INDISPONÍVEL"}</strong>
          {microphonePermission === "suspended" ? (
            <button onClick={activateMicrophone} type="button">ATIVAR LEITURA</button>
          ) : !["ready", "requesting"].includes(microphonePermission) ? (
            <button onClick={() => prepareMicrophone()} type="button">TENTAR NOVAMENTE</button>
          ) : null}
        </div>
        <div>
          <span>PRÓXIMO</span>
          <strong>{audienceWarmup.pendingAdvance?.label || "—"}</strong>
        </div>
      </section>
      <aside className={styles.indexNav} aria-label="Índice da Cena 0">
        <strong>ÍNDICE / CENA 0</strong>
        <span>{sceneZeroStageLabel(sceneZero.stage)}</span>
        <nav>
          {SCENE_ZERO_INDEX.map(([id, label], index) => (
            <a
              aria-current={activeIndexSection === id ? "location" : undefined}
              className={activeIndexSection === id ? styles.activeIndexLink : ""}
              href={`#${id}`}
              key={id}
              onClick={(event) => navigateToSection(event, id)}
            >
              <b>{`${index + 1}`.padStart(2, "0")}</b>
              {label}
            </a>
          ))}
        </nav>
        <button className={styles.attentionButton} onClick={callAttention} type="button">
          CHAMAR ATENÇÃO
        </button>
        <details className={styles.manualInstructionPanel} open>
          <summary>INSTRUÇÃO AVULSA</summary>
          <div className={styles.manualInstructionComposer}>
            <div className={styles.manualInstructionTarget}>
              <label>
                PARA O BOT · FALA SOBRE SI
                <input
                  aria-label="Instrução avulsa para o bot"
                  disabled={manualInstructionPending}
                  onChange={(event) => setManualBotInstruction(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      void sendManualInstruction("bot");
                    }
                  }}
                  placeholder="Ex.: estou cansado"
                  value={manualBotInstruction}
                />
              </label>
              <button
                className={styles.manualInstructionSend}
                disabled={manualInstructionPending || !manualBotInstruction.trim()}
                onClick={() => sendManualInstruction("bot")}
                type="button"
              >PUBLICAR FALA DO BOT</button>
            </div>
            <div className={styles.manualInstructionTarget}>
              <label>
                PARA O PARTICIPANTE / PÚBLICO
                <input
                  aria-label="Instrução avulsa para o participante ou público"
                  disabled={manualInstructionPending}
                  onChange={(event) => setManualUserInstruction(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      void sendManualInstruction("user");
                    }
                  }}
                  placeholder="Ex.: você está cansado?"
                  value={manualUserInstruction}
                />
              </label>
              <button
                className={styles.manualInstructionSend}
                disabled={manualInstructionPending || !manualUserInstruction.trim()}
                onClick={() => sendManualInstruction("user")}
                type="button"
              >PUBLICAR PARA O PÚBLICO</button>
            </div>
            <small>As duas falas usam o chatbot normal e não avançam o fluxo.</small>
          </div>
        </details>
        <section
          aria-label="Resposta da pergunta atual"
          className={styles.reactionControls}
          data-phase={audienceWarmup.phase || "idle"}
          data-pending={pending || ""}
        >
          <small>RESPOSTA DESTA PERGUNTA · ↑ MUITOS · ↓ POUCOS</small>
          {[...responseOptions].reverse().map((option) => (
            <button
              aria-pressed={audienceWarmup.currentResponse?.promptId === activeWarmupPrompt?.id && audienceWarmup.currentResponse?.kind === option.kind}
              className={audienceWarmup.currentResponse?.promptId === activeWarmupPrompt?.id && audienceWarmup.currentResponse?.kind === option.kind ? styles.selectedReaction : ""}
              data-kind={option.kind}
              disabled={Boolean(pending) || !reactionControlsActive}
              key={option.kind}
              onClick={() => warmupAction("record-response", option)}
              type="button"
            >{option.label}</button>
          ))}
        </section>
        <div className={styles.reelsControls}>
          <button
            className={styles.reelsStartButton}
            disabled={Boolean(pending)}
            onClick={() => operatorCommand("/instagram reels-da-peca")}
            type="button"
          >INICIAR REELS + COMENTÁRIOS</button>
          <button
            className={styles.reelsStopButton}
            disabled={!instagram.reelsAutoplayActive && pending !== "/instagram reels-da-peca"}
            onClick={stopReels}
            type="button"
          >PARAR REELS / COMENTÁRIOS</button>
        </div>
      </aside>

      <section aria-label="Boot da Cena 0" className={styles.bootPanel} id="scene-zero-boot">
        <div className={styles.bootHeading}>
          <span>01</span>
          <div>
            <h2>BOOT</h2>
            <p>INICIA A BIOS E A VERIFICAÇÃO HUMANA</p>
          </div>
        </div>
        <div className={styles.bootStatus}>
          <strong>{["STANDBY", "BOOTING", "BOOT_FAILED"].includes(sceneZero.unlock?.status) ? (sceneZero.unlock?.bootProgress || 0) : (sceneZero.unlock?.progress || 0)}%</strong>
          <span>{["STANDBY", "BOOTING", "BOOT_FAILED"].includes(sceneZero.unlock?.status) ? "BIOS" : "DESBLOQUEIO"} · {unlockStatusLabel}</span>
        </div>
        <div className={styles.bootActions}>
          <button
            className={styles.bootPrimary}
            disabled={Boolean(pending) || sceneZero.unlock?.status !== "STANDBY"}
            onClick={bootScene}
            type="button"
          >BOOT</button>
          <button
            className={styles.bootReset}
            disabled={Boolean(pending)}
            onClick={() => operatorCommand("/reset")}
            type="button"
          >REINICIAR</button>
          {sceneZero.unlock?.status === "BOOT_FAILED" ? (
            <button
              className={styles.biosEndButton}
              disabled={Boolean(pending) || sceneZero.unlock?.bootComplete}
              onClick={() => warmupAction("unlock-end-bios")}
              type="button"
            >{sceneZero.unlock?.bootComplete ? "ENCERRANDO BIOS..." : "ENCERRAR BIOS"}</button>
          ) : null}
        </div>
      </section>

      <section aria-label="Escuta de decibéis" className={`${styles.bootPanel} ${styles.soundCheckReturnPanel}`} id="scene-zero-sound-check">
        <div className={styles.bootHeading}>
          <span>02</span>
          <div>
            <h2>ESCUTA DE DECIBÉIS</h2>
            <p>RETORNA AO MEDIDOR LOGO DEPOIS DA BIOS</p>
          </div>
        </div>
        <div className={styles.bootStatus}>
          <strong>{Math.round(Number(sceneZero.unlock?.soundCheck?.liveLevel) || 0)}%</strong>
          <span>{(sceneZero.unlock?.soundCheck?.phase || "AGUARDANDO").replaceAll("_", " ").toUpperCase()}</span>
        </div>
        <div className={styles.bootActions}>
          <button
            className={styles.bootPrimary}
            disabled={Boolean(pending) || !sceneZero.unlock?.bootComplete}
            onClick={() => sceneAction("return-to-sound-check")}
            type="button"
          >VOLTAR À ESCUTA</button>
        </div>
      </section>

      <section className={styles.warmupDisclosure} data-ready={Boolean(snapshot.sceneZero)} id="scene-zero-unlock">
        <button
          aria-expanded={warmupOpen}
          className={styles.warmupDisclosureToggle}
          onClick={() => setWarmupOpen((current) => !current)}
          type="button"
        >
          <span className={styles.warmupDisclosureTitle}>
            <strong>ESQUENTAR PÚBLICO</strong>
            <small>AQUECIMENTO DA PLATEIA · AÇÕES E PROGRESSO</small>
          </span>
          <span className={styles.warmupDisclosureStatus}>
            {sceneZero.unlock?.progress || 0}% · {unlockStatusLabel}
          </span>
          <span className={styles.warmupDisclosureAction} aria-hidden="true" />
        </button>
        {warmupOpen ? (
          <div className={styles.warmupDisclosureBody}>
            <AudienceWarmupController
              canFinishUnlock={sceneZero.suitcaseGame?.status === "finished"}
              disabled={Boolean(pending)}
              onLog={(line) => setNotice(line)}
              showBootButton={false}
              state={snapshot.audienceWarmup}
              unlock={sceneZero.unlock}
            />
          </div>
        ) : null}
      </section>

      <ControlBlock id="scene-zero-participant" title="ESCOLHER PARTICIPANTE" wide>
        <Button primary onClick={() => sceneAction("participant-volunteers")} pending={pending || participantSelectionBusy}>INICIAR SELEÇÃO / 5s</Button>
        <Button onClick={() => sceneAction("choose-another-participant")} pending={pending || participantSelectionBusy}>NOVA ROLETA / OUTRA PESSOA</Button>
        {manualMode && participantSelection.status === "ready_countdown" ? (
          <Button primary onClick={() => sceneAction("participant-countdown-start", { sequence: participantSelection.sequence })} pending={pending}>SEGUIR → INICIAR 5s</Button>
        ) : null}
        {manualMode && participantSelection.status === "selected" ? (
          <Button primary onClick={() => sceneAction("participant-continue", { sequence: participantSelection.sequence })} pending={pending}>SEGUIR → CHAMAR AO CENTRO</Button>
        ) : null}
        <Readout label="ETAPA DA SELEÇÃO" value={participantSelection.status === "countdown" ? `MÃOS LEVANTADAS — ${participantCountdown}s` : participantSelection.status === "awaiting_invite" ? "AGUARDANDO FIM DA FALA" : participantSelection.status === "ready_countdown" ? "FALA CONCLUÍDA · AGUARDANDO →" : participantSelection.status === "selected" ? manualMode ? "NOME NA TELA · AGUARDANDO →" : "NOME NA TELA · 5s" : participantSelection.status === "post_selection" ? "FALANDO COM PARTICIPANTE" : (participantSelection.status || "idle").toUpperCase()} />
        <Readout label="PARTICIPANTE ESCOLHIDO" value={sceneZero.currentParticipant?.name} />
        <details className={styles.participantDetails}>
          <summary>DETALHES DA ROLETA</summary>
          <Readout label="NOMES NA ROLETA" value={(participantSelection.candidates || []).map((participant) => participant.name).join(" · ")} />
          <Readout label="COMENTÁRIO DA ROLETA" value={participantSelection.lastComment} />
          <small>Marcus Garcia e Victor Cappa nunca entram no sorteio.</small>
        </details>
      </ControlBlock>

      <ControlBlock id="scene-zero-suitcases" title="JOGO DAS MALAS" wide>
        {manualMode ? (
          <div className={styles.manualSuitcaseDraws} aria-label="Sorteio manual de recuperação das malas">
            <strong>RECUPERAÇÃO MANUAL</strong>
            <span>Interrompe a etapa atual e inicia a roleta escolhida.</span>
            <Button danger onClick={() => sceneAction("suitcase-manual-draw", { suitcase: 2 })} pending={pending}>SORTEAR MALA 2</Button>
            <Button danger onClick={() => sceneAction("suitcase-manual-draw", { suitcase: 3 })} pending={pending}>SORTEAR MALA 3</Button>
            <Button danger onClick={() => sceneAction("suitcase-manual-draw", { suitcase: 1 })} pending={pending}>SORTEAR MALA 1</Button>
          </div>
        ) : null}
        <div className={styles.suitcaseOverview}>
          <span>{(suitcaseGame.status || "idle").toUpperCase()}</span>
          <strong>MALA ATUAL: {suitcaseGame.currentSuitcase || "—"}</strong>
          <span>PARTICIPANTE: {sceneZero.currentParticipant?.name || "—"}</span>
          <span>ORDEM REALIZADA: {(suitcaseGame.openedSuitcases || []).join(" → ") || "—"}</span>
          {suitcaseChoice.status === "briefing" ? <span>ROBÔ EXPLICANDO AS INSTRUÇÕES...</span> : null}
          {emergenceWaiting ? <span>LAPSO CONCLUÍDO · AGUARDANDO SETA →</span> : null}
          {suitcaseChoice.status === "briefing_ready" ? <span>ETAPA DA EXPLICAÇÃO CONCLUÍDA · AGUARDANDO SETA →</span> : null}
          {suitcaseChoice.status === "announcing" ? <span>ROBÔ EXPLICANDO A PRÓXIMA MALA...</span> : null}
          {suitcaseChoice.status === "ready" ? <span>{manualMode ? "EXPLICAÇÃO CONCLUÍDA · AGUARDANDO SETA →" : "EXPLICAÇÃO CONCLUÍDA · SORTEIO EM INSTANTES"}</span> : null}
          {preDrawHangmanWaitingToStart ? <span>INSTRUÇÃO DA FORCA CONCLUÍDA · AGUARDANDO SETA →</span> : null}
          {preDrawHangmanWaitingToDraw ? <span>FORCA CONCLUÍDA · AGUARDANDO SORTEIO →</span> : null}
          {gincanaRetryWaiting ? <span>FALA DE FALHA CONCLUÍDA · AGUARDANDO REPETIÇÃO →</span> : null}
          {hangmanRetryWaiting ? <span>FALA DE FALHA CONCLUÍDA · AGUARDANDO REPETIÇÃO DA FORCA →</span> : null}
          {suitcaseInstructionWaiting ? <span>FALA CONCLUÍDA · AGUARDANDO SETA →</span> : null}
          {finalInstructionReady ? <span>DISCO NO TOCA-DISCOS · AGUARDANDO SETA →</span> : null}
          {suitcaseCuePhase === "drawing" ? <span>SORTEANDO MALA...</span> : null}
          {suitcaseCuePhase === "selected" ? <Button primary onClick={() => runSuitcaseAdvance("suitcase-cue-open", { selectionSequence: suitcaseGame.suitcaseSelectionSequence })} pending={pending}>SEGUIR → ABRA A MALA</Button> : null}
          {suitcaseCuePhase === "open" ? <Button primary onClick={() => runSuitcaseAdvance("suitcase-cue-continue", { selectionSequence: suitcaseGame.suitcaseSelectionSequence })} pending={pending}>SEGUIR → ETAPA DA MALA</Button> : null}
          <Button
            primary
            onClick={() => runSuitcaseAdvance(finalInstructionReady ? "suitcase-finish" : suitcaseInstructionWaiting ? "suitcase-content-instruction-continue" : emergenceWaiting ? "suitcase-emergence-continue" : preDrawHangmanWaitingToStart ? "suitcase-predraw-hangman-start" : preDrawHangmanWaitingToDraw ? "suitcase-predraw-continue" : gincanaRetryWaiting ? "gincana-retry-start" : hangmanRetryWaiting ? "hangman-retry-start" : suitcaseChoice.status === "ready" ? "suitcase-choice-continue" : suitcaseChoice.status === "briefing_ready" ? "suitcase-briefing-continue" : "suitcase-next")}
            pending={pending || (!nextSuitcase && !finalInstructionReady && !suitcaseInstructionWaiting) || (suitcaseActivityBusy && !suitcaseInstructionWaiting && !gincanaRetryWaiting && !hangmanRetryWaiting) || (preDrawHangmanBusy && !preDrawHangmanWaitingToStart && !preDrawHangmanWaitingToDraw && !hangmanRetryWaiting) || ["briefing", "announcing", "starting"].includes(suitcaseChoice.status) || ["drawing", "selected", "open"].includes(suitcaseCuePhase)}
          >
            {finalInstructionReady ? "SEGUIR → COMPLETAR DESBLOQUEIO" : suitcaseInstructionWaiting ? "SEGUIR → PRÓXIMA FALA" : emergenceWaiting ? "SEGUIR → PRÓXIMA FALA" : preDrawHangmanWaitingToStart ? "SEGUIR → INICIAR FORCA" : preDrawHangmanWaitingToDraw ? "SEGUIR → SORTEAR SEGUNDA MALA" : gincanaRetryWaiting ? "SEGUIR → REPETIR 15s" : hangmanRetryWaiting ? "SEGUIR → REPETIR FORCA" : suitcaseInstructionBusy ? "AGUARDANDO FIM DA FALA" : preDrawHangmanBusy ? "DESAFIO ANTES DO SORTEIO EM CURSO" : nextSuitcase ? suitcaseChoice.status === "ready" ? "SEGUIR → SORTEAR MALA" : suitcaseChoice.status === "briefing_ready" ? "SEGUIR → PRÓXIMA TELA" : "ROBÔ ESCOLHER PRÓXIMA MALA" : "AGUARDANDO INSTRUÇÃO DO DISCO"}
          </Button>
        </div>
        <div className={styles.suitcaseGrid}>
          <section className={`${styles.suitcaseCard} ${suitcaseGame.currentSuitcase === 2 ? styles.activeSuitcase : ""}`}>
            <h3>MALA 2 / BEXIGAS E CHAVE</h3>
            <Button onClick={() => setOpenSuitcaseControls((current) => current === 2 ? null : 2)} pressed={openSuitcaseControls === 2}>{openSuitcaseControls === 2 ? "COMPRIMIR" : "CONTROLES"}</Button>
            <div className={styles.suitcaseDetails} hidden={openSuitcaseControls !== 2}>
              <Readout label="DESAFIO ATIVO" value={gincana.currentTask?.text || "AGUARDANDO MALA 2"} />
              <Readout label="ALVO" value={gincana.currentTask?.targetLabel || "CHAVE"} />
              <div className={`${styles.timer} ${["complete", "failed"].includes(gincanaTimer.status) ? styles.timerComplete : ""}`}>{gincanaSeconds ?? "—"}</div>
              <strong className={styles.timerStatus}>{(gincanaTimer.status || "idle").toUpperCase()}</strong>
              <Button primary onClick={() => sceneAction("gincana-timer-start")} pending={pending || suitcaseGame.currentSuitcase !== 2 || !gincana.currentTask || suitcaseContentInstruction.status !== "complete" || ["drawing", "selected", "open"].includes(suitcaseCuePhase)}>INICIAR 15s</Button>
              <Button
                primary={gincanaSoundtrack.status !== "playing"}
                danger={gincanaSoundtrack.status === "playing"}
                onClick={() => sceneAction(gincanaSoundtrack.status === "playing" ? "gincana-soundtrack-stop" : "gincana-soundtrack-play")}
                pending={pending || suitcaseGame.currentSuitcase !== 2 || (gincanaSoundtrack.status !== "playing" && gincanaTimer.status !== "running")}
              >
                {gincanaSoundtrack.status === "playing" ? "PARAR UBA UBA HEY" : "TOCAR UBA UBA HEY"}
              </Button>
              <Button onClick={() => sceneAction("gincana-timer-pause")} pending={pending || gincanaTimer.status !== "running"}>PAUSAR</Button>
              <Button onClick={() => sceneAction("gincana-timer-resume")} pending={pending || gincanaTimer.status !== "paused"}>CONTINUAR</Button>
              <Button onClick={() => sceneAction("gincana-timer-restart")} pending={pending || !gincana.currentTask}>REINICIAR 15s</Button>
              <Button primary onClick={() => sceneAction("gincana-complete")} pending={pending || !gincana.currentTask || Boolean(gincana.result) || ["drawing", "selected", "open"].includes(suitcaseCuePhase)}>SUCESSO</Button>
              <Button danger onClick={() => sceneAction("gincana-failed")} pending={pending || !gincana.currentTask || Boolean(gincana.result) || ["drawing", "selected", "open"].includes(suitcaseCuePhase)}>FALHA</Button>
              <Readout label="RESULTADO" value={gincana.result ? `${gincana.result.toUpperCase()} · ${gincana.elapsedSeconds ?? 0}s` : gincanaTimer.status === "complete" ? "TEMPO ESGOTADO" : "AGUARDANDO"} />
            </div>
          </section>

          <section className={`${styles.suitcaseCard} ${suitcaseGame.currentSuitcase === 3 || preDrawHangmanActive ? styles.activeSuitcase : ""}`}>
            <h3>DESAFIO ANTES DA SEGUNDA MALA / FORCA — 60s</h3>
            <Button onClick={() => setOpenSuitcaseControls((current) => current === 3 ? null : 3)} pressed={openSuitcaseControls === 3}>{openSuitcaseControls === 3 ? "COMPRIMIR" : "CONTROLES"}</Button>
            <div className={styles.suitcaseDetails} hidden={openSuitcaseControls !== 3}>
              <label className={styles.suitcaseSelect}>
                PALAVRA / EXPRESSÃO
                <select value={selectedHangmanWordId} onChange={(event) => setSelectedHangmanWordId(event.target.value)}>
                  {SCENE_ZERO_HANGMAN_WORDS.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.text} · {entry.category}</option>
                  ))}
                </select>
              </label>
              <Button onClick={() => sceneAction("hangman-configure", { wordId: selectedHangmanWordId })} pending={pending || (!preDrawHangmanActive && suitcaseGame.currentSuitcase !== 3) || hangman.status === "theme-drawing"}>ESCOLHER PALAVRA</Button>
              <Button onClick={() => sceneAction("hangman-new")} pending={pending || (!preDrawHangmanActive && suitcaseGame.currentSuitcase !== 3) || hangman.status === "theme-drawing"}>SORTEAR NOVA</Button>
              <Readout label="PALAVRA OCULTA" value={hangmanPublic.progress || "—"} />
              <Readout label="TEMA" value={(hangman.theme || "—").toUpperCase()} />
              <Readout label="CRONÔMETRO AUTOMÁTICO" value={`${hangmanSeconds}s · ${(hangman.timer?.status || "idle").toUpperCase()}`} />
              <Readout label="ERROS" value={`${hangman.errorCount || 0}/4 · GRAVIDADE INDICADA PELA COR DA FORCA`} />
              <div className={styles.hangmanLetters} aria-label="Letras da forca">
                {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => (
                  <button
                    disabled={Boolean(pending) || !hangmanActive || hangmanUsed.has(letter)}
                    key={letter}
                    onClick={() => sceneAction("hangman-guess", { guess: letter })}
                    type="button"
                  >{letter}</button>
                ))}
              </div>
              <label className={styles.hangmanGuessField}>
                PALPITE COMPLETO
                <input
                  onChange={(event) => setHangmanGuess(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && hangmanGuess.trim()) {
                      event.preventDefault();
                      void sceneAction("hangman-guess", { guess: hangmanGuess }).then((result) => result && setHangmanGuess(""));
                    }
                  }}
                  value={hangmanGuess}
                />
              </label>
              <Button onClick={() => sceneAction("hangman-guess", { guess: hangmanGuess }).then((result) => result && setHangmanGuess(""))} pending={pending || !hangmanActive || !hangmanGuess.trim()}>ENVIAR PALPITE</Button>
              <Button danger onClick={() => sceneAction("hangman-error")} pending={pending || !hangmanActive}>MARCAR ERRO</Button>
              <Button onClick={() => sceneAction("hangman-reveal")} pending={pending || !hangman.activity}>REVELAR PALAVRA</Button>
              <Button onClick={() => sceneAction("hangman-restart")} pending={pending || !hangman.activity}>REINICIAR</Button>
              <Readout label="LETRAS / PALPITES USADOS" value={(hangmanPublic.usedGuesses || []).join(" · ").toUpperCase() || "—"} />
              <Readout label="RESULTADO" value={hangman.retry?.status === "announcing" ? "COMENTÁRIO DE FALHA → +30s" : hangman.resultMessage || (hangman.status || "idle").toUpperCase()} />
            </div>
          </section>

          <section className={`${styles.suitcaseCard} ${suitcaseGame.currentSuitcase === 1 ? styles.activeSuitcase : ""}`}>
            <h3>MALA 1 / FIM DO TUTORIAL</h3>
            <Button onClick={() => setOpenSuitcaseControls((current) => current === 1 ? null : 1)} pressed={openSuitcaseControls === 1}>{openSuitcaseControls === 1 ? "COMPRIMIR" : "CONTROLES"}</Button>
            <div className={styles.suitcaseDetails} hidden={openSuitcaseControls !== 1}>
              <Readout label="SEQUÊNCIA AUTOMÁTICA" value="FIM DO TUTORIAL → GLITCH CRESCENTE → BIOS CORROMPIDA → BLACKOUT" />
              <Readout label="STATUS" value={morelBiosBlackout ? "BLACKOUT FINAL" : morelBiosRunning ? "BIOS CORROMPIDA NA PROJEÇÃO" : morelBios.status === "stopped" ? "INTERROMPIDA" : "AGUARDANDO"} />
              <Button primary onClick={() => sceneAction("morel-bios-start")} pending={pending || suitcaseGame.currentSuitcase !== 1}>RECARREGAR GLITCH + BIOS</Button>
              <Button danger onClick={() => sceneAction("morel-bios-stop")} pending={pending || !morelBiosRunning}>INTERROMPER BIOS / BLACKOUT</Button>
              <Readout label="FIM DO JOGO" value={suitcaseGame.status === "finished" ? `FINALIZADO · ${suitcaseGame.endedAt ? new Date(suitcaseGame.endedAt).toLocaleTimeString("pt-BR") : "REGISTRADO"}` : "A BARRA PERMANECE TRAVADA ATÉ FINALIZAR"} />
            </div>
          </section>
        </div>

        <details className={styles.legacySuitcaseControls}>
          <summary>CONTROLES LEGADOS DAS MALAS / PESQUISA DO PARTICIPANTE</summary>
          <Readout label="SUITCASE DIRECTOR EXISTENTE" value={`${suitcase.phase || "IDLE"} / ${suitcase.activeExperience || "—"}`} />
          <Button onClick={() => operatorCommand("/mala start")} pending={pending}>INICIAR / RETOMAR LEGADO</Button>
          <Button primary onClick={() => sceneAction("suitcase-research-person")} pending={pending || !sceneZero.currentParticipant?.name}>PESQUISAR PARTICIPANTE</Button>
          <Button onClick={() => sceneAction("suitcase-research-stop")} pending={pending || instagram.browserMode !== "person_research"}>FECHAR PESQUISA</Button>
          <Button danger onClick={() => operatorCommand("/mala abort")} pending={pending}>INTERROMPER JOGO LEGADO</Button>
        </details>
      </ControlBlock>

      <section className={styles.extrasDisclosure} id="scene-zero-extras">
        <button
          aria-expanded={extrasOpen}
          className={styles.extrasDisclosureToggle}
          onClick={() => setExtrasOpen((current) => !current)}
          type="button"
        >
          <span>
            <strong>OUTROS CONTROLES</strong>
            <small>MEMÓRIA · PERSONALIDADE · DIREÇÃO · COLETA · GLITCH · NAVEGADOR · ÁUDIO</small>
          </span>
          <span className={styles.extrasDisclosureAction} aria-hidden="true" />
        </button>
        {extrasOpen ? <div className={styles.extrasDisclosureBody}>

      <section className={styles.memoryPanel} id="scene-zero-memory">
        <div className={styles.memoryHeading}>
          <div>
            <h2>MEMÓRIA DA SESSÃO</h2>
            <p>Registra uma observação silenciosa para o bot usar como contexto quando for relevante.</p>
          </div>
          <strong>{snapshot.memories?.length || 0} REGISTROS</strong>
        </div>
        <div className={styles.memoryComposer}>
          <input
            aria-label="Nova memória da sessão"
            onChange={(event) => setMemoryText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                addMemory();
              }
            }}
            placeholder="Ex.: uma pessoa na primeira fila está filmando tudo"
            value={memoryText}
          />
          <Button primary onClick={addMemory} pending={pending || !memoryText.trim()}>ADICIONAR /MEMORY</Button>
        </div>
        {latestMemories.length ? (
          <ol className={styles.memoryList} aria-label="Memórias mais recentes">
            {latestMemories.map((memory) => (
              <li key={memory.id}>
                <time>{new Date(memory.timestamp).toLocaleTimeString("pt-BR")}</time>
                <span>{memory.content}</span>
              </li>
            ))}
          </ol>
        ) : <p className={styles.emptyMemory}>NENHUMA MEMÓRIA REGISTRADA NESTA SESSÃO.</p>}
      </section>

      <section className={styles.personalityPanel} id="scene-zero-personality">
        <div>
          <h2>ORIENTAÇÕES DE PERSONALIDADE</h2>
          <p>Orienta as próximas falas silenciosamente, sem trocar etapa nem interromper processos ativos.</p>
        </div>
        <label className={styles.orientationField}>
          DIREÇÃO PERSISTENTE PARA O BOT
          <textarea
            value={personalityGuidance}
            onChange={(event) => {
              setPersonalityGuidance(event.target.value);
              setPersonalityGuidanceDirty(true);
            }}
            placeholder="Ex.: mais impaciente e sarcástica; respostas mais curtas; implicar com excesso de confiança"
            rows={3}
          />
        </label>
        <div className={styles.personalityActions}>
          <Button
            primary
            onClick={() => savePersonalityGuidance(personalityGuidance)}
            pending={pending || !personalityGuidanceDirty}
          >SALVAR ORIENTAÇÕES</Button>
          <Button
            danger
            onClick={clearPersonalityGuidance}
            pending={pending || (!personalityGuidance && !sceneZero.personalityGuidance?.text && !sceneZero.personalityGuidance?.quickDirections?.length)}
          >LIMPAR</Button>
        </div>
        <div className={styles.personalityQuickGrid}>
          {SCENE_ZERO_PERSONALITY_DIRECTIONS.map((direction) => {
            const active = sceneZero.personalityGuidance?.quickDirections?.includes(direction.id);
            return (
              <Button
                key={direction.id}
                onClick={() => togglePersonalityDirection(direction)}
                pending={pending}
                pressed={Boolean(active)}
                primary={Boolean(active)}
              >{direction.label}</Button>
            );
          })}
        </div>
        <Readout
          label="ORIENTAÇÃO ATIVA"
          value={[
            sceneZero.personalityGuidance?.text,
            ...(sceneZero.personalityGuidance?.quickDirections || []).map((id) => (
              SCENE_ZERO_PERSONALITY_DIRECTIONS.find((direction) => direction.id === id)?.label
            ))
          ].filter(Boolean).join(" · ") || "NENHUMA"}
        />
      </section>

      <section className={styles.stagePanel} id="scene-zero-direction">
        <h2>DIREÇÃO DRAMATÚRGICA</h2>
        <p>O botão muda o contexto. A fala é improvisada pelo bot.</p>
        <div className={styles.stageGrid}>
          {PRIMARY_STAGES.map(([stage, label]) => (
            <button
              className={sceneZero.stage === stage ? styles.activeStage : styles.stageButton}
              disabled={Boolean(pending)}
              key={stage}
              onClick={() => sceneAction("set-stage", { stage })}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <label className={styles.detailField}>
          CONTEXTO OPCIONAL PARA A PRÓXIMA AÇÃO
          <input value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Ex.: metade levantou a mão; houve silêncio; alguém hesitou" />
        </label>
      </section>

      <div className={styles.blocks}>
        <ControlBlock id="scene-zero-collection" title="PERGUNTAS / COLETA">
          <small>Na etapa COLETA, alimenta o dataset. Nas demais etapas, faz perguntas avulsas sem mudar ou encerrar o processo atual.</small>
          <Button onClick={() => sceneAction("collection-new-question")} pending={pending}>NOVA PERGUNTA</Button>
          <Button onClick={() => sceneAction("collection-rephrase")} pending={pending}>REFORMULAR</Button>
          <Button onClick={() => sceneAction("collection-comment")} pending={pending}>COMENTAR RESULTADO</Button>
          <Button onClick={() => sceneAction("collection-refresh-local-context")} pending={pending}>ATUALIZAR CONTEXTO SP</Button>
          <Button danger onClick={() => sceneAction("collection-end")} pending={pending}>ENCERRAR COLETA</Button>
          <div className={styles.quickGrid}>
            {COLLECTION_RESULTS.map(([result, label]) => (
              <Button key={result} onClick={() => recordCollectionResult(result)} pending={pending}>{label}</Button>
            ))}
          </div>
          <div className={styles.quickGrid}>
            {["0", "1", "2", "3", "4", "5+"].map((count) => (
              <Button key={count} onClick={() => recordCollectionResult("count", count)} pending={pending}>{count}</Button>
            ))}
          </div>
          <label className={styles.observationField}>
            OBSERVAÇÃO / CORREÇÃO RÁPIDA
            <input
              value={collectionObservation}
              onChange={(event) => setCollectionObservation(event.target.value)}
              placeholder="Ex.: demoraram; riram; uma pessoa respondeu; plateia confusa"
            />
          </label>
          <Button
            onClick={() => recordCollectionResult("qualitative")}
            pending={pending || !collectionObservation.trim()}
          >REGISTRAR SÓ OBSERVAÇÃO</Button>
          <Readout label="ÚLTIMA PERGUNTA" value={collection.lastQuestion} />
          <Readout label="AÇÃO SOLICITADA" value={collection.lastRequestedAction} />
          <Readout label="ÚLTIMO COMENTÁRIO" value={collection.lastComment} />
          <Readout label="TEMPORIZAÇÃO" value={collection.activeCountdown?.status === "running"
            ? `${countdownSeconds(collection.activeCountdown.endsAt, now)}s / ${collection.activeCountdown.durationSeconds}s`
            : (collection.activeCountdown?.status || "idle").toUpperCase()} />
          <Readout label="DATASET" value={`${collection.questions?.length || 0} intervenções · ${collection.segments?.length || 0} segmentos · ${collection.instructionCount || 0} instruções`} />
          <Readout label="OBEDIÊNCIA" value={collection.obedience
            ? `respostas ${collection.obedience.answered || 0} · resistência ${collection.obedience.resisted || 0} · demora ${collection.obedience.delayed || 0} · confusão ${collection.obedience.confused || 0} · antecipação ${collection.obedience.anticipated || 0}`
            : "—"} />
          <Readout label="CONTEXTO SP" value={collection.localContext?.status === "ready"
            ? `${new Date(collection.localContext.updatedAt).toLocaleString("pt-BR")} — ${collection.localContext.summary}`
            : collection.localContext?.status === "error"
              ? `ERRO — ${collection.localContext.error || "não atualizado"}`
              : (collection.localContext?.status || "idle").toUpperCase()} />
          {questions.length ? <ol className={styles.history}>{questions.slice(0, 8).map((item) => <li key={item.id}>{item.text}</li>)}</ol> : null}
        </ControlBlock>

        <ControlBlock id="scene-zero-singing" title="CANTAR 15s" wide>
          <div className={`${styles.timer} ${timer.status === "complete" ? styles.timerComplete : ""}`}>{seconds}</div>
          <strong className={styles.timerStatus}>{timer.status === "complete" ? "FIM" : (timer.status || "idle").toUpperCase()}</strong>
          <Button primary onClick={() => sceneAction("timer-start")} pending={pending}>INICIAR TIMER</Button>
          <Button onClick={() => sceneAction("timer-pause")} pending={pending}>PAUSAR</Button>
          <Button onClick={() => sceneAction("timer-resume")} pending={pending}>CONTINUAR</Button>
          <Button onClick={() => sceneAction("timer-restart")} pending={pending}>REINICIAR</Button>
          <Button danger onClick={() => sceneAction("timer-cancel")} pending={pending}>CANCELAR</Button>
        </ControlBlock>

        <ControlBlock id="scene-zero-glitch" title="GLITCH" wide>
          <div className={styles.levels}>
            {SCENE_ZERO_GLITCH_LEVELS.map((level) => (
              <Button primary={sceneZero.glitchLevel === level} key={level} onClick={() => sceneAction("set-glitch", { level })} pending={pending}>
                {level === "normal" ? "NORMAL" : level.replace("glitch-", "GLITCH ").toUpperCase()}
              </Button>
            ))}
          </div>
          <Button onClick={() => sceneAction("step-glitch", { delta: 1 })} pending={pending}>GLITCH +</Button>
          <Button onClick={() => sceneAction("step-glitch", { delta: -1 })} pending={pending}>GLITCH -</Button>
          <Button danger onClick={() => sceneAction("set-glitch", { level: "normal" })} pending={pending}>RESET</Button>
          <div className={styles.glitchVideoConfig}>
            <label className={styles.glitchVideoField}>
              VÍDEO FINAL
              <select value={glitchVideoFile} onChange={(event) => setGlitchVideoFile(event.target.value)}>
                {glitchVideos.length ? glitchVideos.map((video) => (
                  <option key={video.file} value={video.file}>{video.file}</option>
                )) : <option value="">NENHUM VÍDEO EM assets/videos/glitch</option>}
              </select>
            </label>
            <label className={styles.glitchVideoField}>
              TEMPO DE GLITCH ATÉ O VÍDEO DOMINAR
              <div className={styles.glitchDurationInput}>
                <input
                  max="30"
                  min="0.6"
                  onChange={(event) => setGlitchVideoTransitionSeconds(Number(event.target.value))}
                  step="0.1"
                  type="number"
                  value={glitchVideoTransitionSeconds}
                />
                <span>SEGUNDOS</span>
              </div>
            </label>
            <label className={styles.glitchLoopField}>
              <input checked={glitchVideoLoop} onChange={(event) => setGlitchVideoLoop(event.target.checked)} type="checkbox" />
              REPETIR VÍDEO EM LOOP
            </label>
            <div className={styles.glitchDurationPresets} aria-label="Atalhos de duração do glitch">
              {[1, 3, 5, 10].map((duration) => (
                <Button
                  key={duration}
                  onClick={() => setGlitchVideoTransitionSeconds(duration)}
                  pressed={glitchVideoTransitionSeconds === duration}
                  primary={glitchVideoTransitionSeconds === duration}
                >{duration}s</Button>
              ))}
            </div>
          </div>
          <Button primary onClick={() => glitchVideoAction("video")} pending={pending || !glitchVideoFile}>GLITCH + VÍDEO</Button>
          <Button danger onClick={() => glitchVideoAction("video-stop")} pending={pending || globalGlitch.mode !== "video"}>VOLTAR AO BOT</Button>
          <Readout
            label="GLITCH + VÍDEO GLOBAL"
            value={globalGlitch.mode === "video"
              ? `${globalGlitch.video?.file || "—"} · ${(globalGlitch.video?.transitionMs || 0) / 1000}s até dominar · ${globalGlitch.video?.loop ? "LOOP" : "SEM LOOP"}`
              : "INATIVO"}
          />
        </ControlBlock>

        <ControlBlock id="scene-zero-browser" title="GOOGLE + INSTAGRAM / COMANDO LIVRE" wide>
          <Button primary onClick={() => sceneAction("instagram-manual-login")} pending={pending}>ABRIR / VERIFICAR LOGIN MANUAL DO INSTAGRAM</Button>
          <Button onClick={copyInstagramPassword} pending={pending}>COPIAR SENHA DO INSTAGRAM</Button>
          <Readout label="LOGIN DO INSTAGRAM" value={instagramLoginVerified ? "SESSÃO AUTENTICADA · PERFIS LIBERADOS" : "USE O PAINEL ABAIXO PARA TOCAR EM CONTINUE/CONTINUAR E CONCLUIR O LOGIN. NENHUMA CREDENCIAL SERÁ PREENCHIDA AUTOMATICAMENTE."} />
          <label className={styles.browserCommandField}>
            COMANDO EM LINGUAGEM NATURAL
            <textarea
              value={browserCommand}
              onChange={(event) => setBrowserCommand(event.target.value)}
              placeholder="Ex.: entre no Google, busque algo e comente. Ao mesmo tempo, abra uma aba do Instagram e procure o perfil do Nikolas Ferreira."
              rows={4}
            />
          </label>
          <Button
            primary
            onClick={() => sceneAction("browser-command-start", { command: browserCommand })}
            pending={pending || !browserCommand.trim()}
          >ENTENDER E EXECUTAR</Button>
          <div className={styles.browserQuickCommands}>
            <div className={styles.browserQuickField}>
              <strong>GOOGLE</strong>
              <input
                aria-label="Comando rápido para o Google"
                value={googleGuidance}
                onChange={(event) => setGoogleGuidance(event.target.value)}
                placeholder="Ex.: buscar notícias sobre IA e comentar a primeira"
              />
              <Button
                onClick={() => sceneAction("google-guidance-start", { guidance: googleGuidance })}
                pending={pending || !googleGuidance.trim()}
              >EXECUTAR GOOGLE</Button>
            </div>
            <div className={styles.browserQuickField}>
              <strong>INSTAGRAM</strong>
              <input
                aria-label="Nome ou perfil para buscar no Instagram"
                value={instagramGuidance}
                onChange={(event) => setInstagramGuidance(event.target.value)}
                placeholder="Ex.: Nikolas Ferreira ou @usuario"
              />
              <Button
                onClick={() => sceneAction("browser-instagram-start", { person: instagramGuidance })}
                pending={pending || !instagramGuidance.trim()}
              >BUSCAR PERFIL</Button>
            </div>
          </div>
          <Button
            danger
            onClick={() => sceneAction("browser-stop")}
            pending={pending || instagram.status === "DISCONNECTED"}
          >FECHAR NAVEGADOR</Button>
          {instagram.embedded && instagram.status !== "DISCONNECTED" && instagramPanelClosed ? (
            <Button onClick={() => updateInstagramPanelVisibility(true)} pending={pending}>MOSTRAR NAVEGADOR</Button>
          ) : null}
          <Readout label="NAVEGADOR REAL" value={`${instagram.status || "DISCONNECTED"} / ${instagram.message || "—"}`} />
          <Readout label="COMANDO EM EXECUÇÃO" value={instagram.research?.guidance || instagram.research?.person || "INATIVO"} />
          {instagram.secondaryBrowser?.active ? (
            <Readout label="ABAS ABERTAS" value={`PRINCIPAL · ${instagram.secondaryBrowser.label || "SECUNDÁRIA"}`} />
          ) : null}
          {instagram.embedded && instagram.status !== "DISCONNECTED" && instagram.embeddedPanelVisible !== false && !instagramPanelClosed ? (
            <div className={styles.instagramPanel}>
              <InstagramBrowserPanel instagram={instagram} onClose={() => updateInstagramPanelVisibility(false)} />
            </div>
          ) : null}
        </ControlBlock>

        <ControlBlock id="scene-zero-airport" title="AEROPORTO / TEA FOR TWO" wide>
          <Readout label="AEROPORTO" value={sceneZero.airportActive ? "TELA ESTÁVEL ATIVA" : "INATIVO"} />
          <Readout label="TEA FOR TWO" value={(sceneZero.teaForTwo?.status || "stopped").toUpperCase()} />
          <Button primary onClick={() => teaAction("tea-play")} pending={pending}>PLAY</Button>
          <Button onClick={() => teaAction("tea-restart")} pending={pending}>RESTART</Button>
          <Button danger onClick={() => teaAction("tea-stop")} pending={pending}>STOP</Button>
        </ControlBlock>
      </div>
        </div> : null}
      </section>
      <footer className={styles.notice}>{pending ? `PROCESSANDO: ${pending}` : notice}</footer>
    </main>
  );
}

function ControlBlock({ children, id, title, wide = false }) {
  return <section className={`${styles.block} ${wide ? styles.wide : ""}`} id={id}><h2>{title}</h2><div className={styles.controls}>{children}</div></section>;
}

function Button({ children, danger = false, onClick, pending, pressed, primary = false }) {
  return <button aria-pressed={pressed} className={danger ? styles.danger : primary ? styles.primary : styles.button} disabled={Boolean(pending)} onClick={onClick} type="button">{children}</button>;
}

function Readout({ label, value }) {
  return <p className={styles.readout}><span>{label}</span><strong>{value || "—"}</strong></p>;
}

function countdownSeconds(endsAt, now) {
  return endsAt ? Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 1000)) : 10;
}
