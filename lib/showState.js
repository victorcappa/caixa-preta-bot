import { randomUUID } from "crypto";
import { createHangmanActivity } from "@/lib/activities";
import {
  BARALHO_MORBIDO_PHASES,
  BARALHO_MORBIDO_TIMELINE_MS,
  createInitialBaralhoMorbidoState,
  drawBaralhoMorbidoCard as drawBaralhoMorbidoCardState,
  publicBaralhoMorbidoSnapshot,
  setBaralhoMorbidoPhase
} from "@/lib/baralho-morbido/state";
import {
  advanceQuedaAviao,
  createInitialQuedaAviaoState,
  publicQuedaAviaoSnapshot,
  QUEDA_AVIAO_PHASES,
  resetQuedaAviaoState,
  setQuedaAviaoDisplayConnection as setQuedaAviaoDisplayConnectionState,
  setQuedaAviaoIndex,
  updateQuedaAviaoState
} from "@/lib/queda-aviao/state";
import {
  createInitialGlitchState,
  glitchVideoSrc,
  normalizeGlitchParams,
  presetParams,
  publicGlitchSnapshot
} from "@/lib/glitch/state";
import {
  createInitialDisplayBlackoutState,
  displayBlackoutTargetIds,
  normalizeDisplayBlackoutTarget,
  publicDisplayBlackoutSnapshot
} from "@/lib/displayBlackout";
import {
  advanceGame as advanceGameState,
  applyGameMove as applyGameMoveState,
  controlStructuredGame as controlStructuredGameState,
  createGameLogEntry,
  createInitialGameState,
  evaluateGameOpportunity,
  publicGameSnapshot,
  setGameSecret as setGameSecretState,
  startGame as startGameState,
  stopGame as stopGameState,
  tickGameAfterTurn
} from "@/lib/host/GameDirector";
import { resolveOpenAIModel } from "@/lib/openaiModels";
import {
  addParticipantToSession,
  getParticipantPool,
  inferSessionParticipantsFromMemory,
  markParticipantsSelected,
  presenceFromMemory,
  saveAudienceParticipants
} from "@/lib/participants";
import { normalizePerformanceEvents } from "@/lib/performanceEvents";
import { getProjectionScreenByPath, normalizeProjectionPath } from "@/lib/projectionScreens";
import {
  abortSuitcases as abortSuitcasesState,
  advanceSuitcases as advanceSuitcasesState,
  applySuitcaseMove as applySuitcaseMoveState,
  createInitialSuitcaseState,
  finishInstagramTimer as finishInstagramTimerState,
  finishSuitcases as finishSuitcasesState,
  forceSuitcaseExperience as forceSuitcaseExperienceState,
  resetSuitcases as resetSuitcasesState,
  startSuitcases as startSuitcasesState
} from "@/lib/suitcases/SuitcaseDirector";
import { DEFAULT_SHOW_MODE } from "@/prompts/modes";

const globalKey = "__caixaPretaShowState";
const PROJECTION_HEARTBEAT_TIMEOUT_MS = 60000;

function createInitialProjectionState() {
  return {
    activeProjectionWindowId: null,
    windows: {},
    lastCommand: null,
    commandSequence: 0
  };
}

function createInitialSceneCueState() {
  return {
    controllerId: null,
    cue: null,
    triggeredAt: null,
    clearAt: null,
    sequence: 0
  };
}

function publicSceneCueSnapshot(sceneCue = createInitialSceneCueState()) {
  return {
    controllerId: sceneCue.controllerId || null,
    cue: sceneCue.cue ? { ...sceneCue.cue } : null,
    triggeredAt: sceneCue.triggeredAt || null,
    clearAt: sceneCue.clearAt || null,
    sequence: Number(sceneCue.sequence || 0)
  };
}

function normalizeSceneCue(cue = {}) {
  const type = ["audio", "video", "image"].includes(cue.type) ? cue.type : "audio";
  const assetPath = `${cue.assetPath || ""}`.trim();

  return {
    id: `${cue.id || randomUUID()}`,
    label: `${cue.label || "Novo Botão"}`.trim() || "Novo Botão",
    type,
    assetPath: assetPath.includes("..") ? "" : assetPath,
    durationMs: Math.max(0, Math.min(Number(cue.durationMs) || 0, 60 * 60 * 1000)),
    color: /^#[0-9a-fA-F]{6}$/.test(`${cue.color || ""}`) ? cue.color : "#ffffff"
  };
}

function publicProjectionSnapshot(projection = createInitialProjectionState()) {
  const now = Date.now();
  const windows = {};

  for (const [id, projectionWindow] of Object.entries(projection.windows || {})) {
    const lastHeartbeatTime = projectionWindow.lastHeartbeatAt
      ? new Date(projectionWindow.lastHeartbeatAt).getTime()
      : 0;
    const heartbeatFresh = lastHeartbeatTime && now - lastHeartbeatTime <= PROJECTION_HEARTBEAT_TIMEOUT_MS;
    const connected = Boolean(projectionWindow.connected && heartbeatFresh);
    const screen = getProjectionScreenByPath(projectionWindow.currentPath);

    windows[id] = {
      ...projectionWindow,
      connected,
      status: connected ? "connected" : "disconnected",
      screenId: screen?.id || null,
      screenLabel: screen?.label || projectionWindow.currentPath || "-"
    };
  }

  const activeProjectionWindowId = windows[projection.activeProjectionWindowId]
    ? projection.activeProjectionWindowId
    : null;

  return {
    activeProjectionWindowId,
    windows,
    lastCommand: projection.lastCommand ? { ...projection.lastCommand } : null,
    commandSequence: projection.commandSequence || 0
  };
}

function nextProjectionWindowId(windows = {}) {
  let index = Object.keys(windows).length + 1;

  while (windows[`projection-${index}`]) {
    index += 1;
  }

  return `projection-${index}`;
}

function createStore() {
  const listeners = new Set();
  const baralhoMorbidoTimers = new Set();
  const quedaAviaoTimers = new Set();
  const glitchTimers = new Set();
  const sceneCueTimers = new Set();
  const state = {
    memories: [],
    conversation: [],
    mode: DEFAULT_SHOW_MODE,
    previousMode: null,
    modeStartedAt: new Date().toISOString(),
    model: resolveOpenAIModel(process.env.OPENAI_MODEL),
    variables: {},
    game: createInitialGameState(),
    suitcase: createInitialSuitcaseState(),
    baralhoMorbido: createInitialBaralhoMorbidoState(),
    quedaAviao: createInitialQuedaAviaoState(),
    glitch: createInitialGlitchState(),
    displayBlackout: createInitialDisplayBlackoutState(),
    sceneCue: createInitialSceneCueState(),
    projection: createInitialProjectionState(),
    participants: {
      session: [],
      history: {}
    },
    instagram: {
      enabled: process.env.INSTAGRAM_ENABLED !== "false",
      embedded: process.env.INSTAGRAM_EMBEDDED !== "false",
      account: "caixapretabot",
      status: "DISCONNECTED",
      message: "desconectado",
      lastError: null,
      lastButtonState: null,
      currentUrl: null,
      lastAction: null,
      targetProfile: null,
      audioMuted: true,
      profileDir: ".runtime/instagram-profile",
      debugDir: null,
      updatedAt: new Date().toISOString(),
      logs: []
    },
    performance: {
      events: [],
      eventLog: [],
      interactions: [],
      activities: [],
      salience: [],
      intensity: "calm",
      phoneProjection: {
        status: "hidden",
        participant: null,
        contentType: null,
        privacyLevel: null,
        requestedAt: null,
        approvedAt: null,
        hiddenAt: null
      }
    }
  };

  function buildSnapshot({ includePrivate = false } = {}) {
    const participantPool = getParticipantPool({
      sessionParticipants: state.participants.session,
      history: state.participants.history
    });

    return {
      memories: [...state.memories],
      conversation: [...state.conversation],
      mode: state.mode,
      previousMode: state.previousMode,
      modeStartedAt: state.modeStartedAt,
      model: state.model,
      variables: { ...state.variables },
      game: includePrivate ? { ...state.game } : publicGameSnapshot(state.game),
      suitcase: includePrivate ? { ...state.suitcase } : publicSuitcaseSnapshot(state.suitcase),
      baralhoMorbido: publicBaralhoMorbidoSnapshot(state.baralhoMorbido),
      quedaAviao: publicQuedaAviaoSnapshot(state.quedaAviao),
      glitch: publicGlitchSnapshot(state.glitch),
      displayBlackout: publicDisplayBlackoutSnapshot(state.displayBlackout),
      sceneCue: publicSceneCueSnapshot(state.sceneCue),
      projection: publicProjectionSnapshot(state.projection),
      participants: {
        session: state.participants.session.map((participant) => ({ ...participant })),
        history: { ...state.participants.history },
        counts: participantPool.counts,
        pool: participantPool.participants
      },
      instagram: {
        ...state.instagram,
        logs: [...state.instagram.logs].slice(-20)
      },
      performance: {
        events: [...state.performance.events],
        eventLog: [...state.performance.eventLog].slice(-80),
        interactions: [...state.performance.interactions].slice(-40),
        activities: state.performance.activities.map(publicActivitySnapshot),
        salience: [...state.performance.salience],
        intensity: state.performance.intensity,
        phoneProjection: { ...state.performance.phoneProjection }
      }
    };
  }

  function snapshot() {
    return buildSnapshot();
  }

  function privateSnapshot() {
    return buildSnapshot({ includePrivate: true });
  }

  function publicActivitySnapshot(activity) {
    return {
      id: activity.id,
      type: activity.type,
      status: activity.status,
      source: activity.source,
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt,
      participants: activity.participants || [],
      step: activity.step,
      publicState: activity.publicState,
      rules: activity.rules || []
    };
  }

  function publicSuitcaseSnapshot(suitcase = createInitialSuitcaseState()) {
    return {
      ...suitcase,
      logs: (suitcase.logs || []).slice(-30),
      currentGame: suitcase.currentGame ? {
        id: suitcase.currentGame.id,
        name: suitcase.currentGame.name,
        active: suitcase.currentGame.active,
        finished: suitcase.currentGame.finished,
        winner: suitcase.currentGame.winner,
        attempts: suitcase.currentGame.attempts,
        maxAttempts: suitcase.currentGame.maxAttempts,
        publicState: suitcase.currentGame.publicState
      } : null
    };
  }

  function logPerformance(entry) {
    const logEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry
    };

    state.performance.eventLog.push(logEntry);
    state.performance.eventLog = state.performance.eventLog.slice(-200);
    return logEntry;
  }

  function emit(event) {
    const payload = {
      event,
      state: snapshot()
    };

    for (const listener of listeners) {
      listener(payload);
    }
  }

  function clearBaralhoMorbidoTimers() {
    for (const timer of baralhoMorbidoTimers) {
      clearTimeout(timer);
    }

    baralhoMorbidoTimers.clear();
  }

  function clearQuedaAviaoTimers() {
    for (const timer of quedaAviaoTimers) {
      clearTimeout(timer);
    }

    quedaAviaoTimers.clear();
  }

  function clearGlitchTimers() {
    for (const timer of glitchTimers) {
      clearTimeout(timer);
    }

    glitchTimers.clear();
  }

  function clearSceneCueTimers() {
    for (const timer of sceneCueTimers) {
      clearTimeout(timer);
    }

    sceneCueTimers.clear();
  }

  function scheduleGlitchStop(delayMs, sequence) {
    const timer = setTimeout(() => {
      glitchTimers.delete(timer);

      if (state.glitch.sequence !== sequence) {
        return;
      }

      state.glitch = {
        ...state.glitch,
        active: false,
        mode: "idle",
        autoStopAt: null,
        updatedAt: new Date().toISOString(),
        video: {
          ...state.glitch.video,
          active: false,
          takeover: false
        }
      };
      emit({ type: "glitch-stop", glitch: publicGlitchSnapshot(state.glitch) });
    }, Math.max(0, delayMs));

    glitchTimers.add(timer);
  }

  function scheduleQuedaAviaoTimer(callback, delayMs) {
    const timer = setTimeout(() => {
      quedaAviaoTimers.delete(timer);
      callback();
    }, Math.max(0, delayMs));

    quedaAviaoTimers.add(timer);
  }

  function emitQuedaAviao(type = "queda-aviao") {
    emit({ type, quedaAviao: publicQuedaAviaoSnapshot(state.quedaAviao) });
  }

  function controlGlitch(action, payload = {}, { source = "operator" } = {}) {
    const normalizedAction = `${action || ""}`.toLowerCase();
    const now = new Date();
    const timestamp = now.toISOString();
    const nextSequence = (state.glitch.sequence || 0) + 1;

    clearGlitchTimers();

    if (normalizedAction === "update") {
      const nextPreset = payload.preset || state.glitch.preset || "normal";
      const nextParams = normalizeGlitchParams(payload.params || payload, state.glitch.params);

      state.glitch = {
        ...state.glitch,
        preset: nextPreset,
        params: nextParams,
        updatedAt: timestamp
      };
      emit({ type: "glitch-update", glitch: publicGlitchSnapshot(state.glitch) });
      return { applied: true, state: publicGlitchSnapshot(state.glitch) };
    }

    if (normalizedAction === "stop" || normalizedAction === "video-stop") {
      state.glitch = {
        ...state.glitch,
        active: false,
        mode: "idle",
        autoStopAt: null,
        updatedAt: timestamp,
        sequence: nextSequence,
        video: {
          ...state.glitch.video,
          active: false,
          takeover: false
        }
      };
      logPerformance({ type: "GLITCH_STOP", source, public: true });
      emit({ type: "glitch-stop", glitch: publicGlitchSnapshot(state.glitch) });
      return { applied: true, state: publicGlitchSnapshot(state.glitch) };
    }

    if (normalizedAction === "trigger" || normalizedAction === "start" || normalizedAction === "continuous" || normalizedAction === "video") {
      const preset = payload.preset || (
        normalizedAction === "continuous" ? "continuous" : normalizedAction === "video" ? "video" : "normal"
      );
      const params = presetParams(preset, payload.params || {});
      const requestedDuration = Number(payload.durationMs || params.averageDurationMs);
      const isContinuous = normalizedAction === "start" || normalizedAction === "continuous" || payload.continuous;
      const isVideo = normalizedAction === "video" || payload.video;
      const file = payload.file || payload.videoFile || state.glitch.video?.file || null;
      const transitionMs = Math.round(Math.max(600, Math.min(30000, Number(payload.transitionMs || 5200))));
      const durationMs = isVideo
        ? null
        : isContinuous
          ? null
          : Math.round(Math.max(80, Math.min(12000, requestedDuration)));
      const autoStopAt = durationMs ? new Date(now.getTime() + durationMs).toISOString() : null;

      state.glitch = {
        ...state.glitch,
        active: true,
        mode: isVideo ? "video" : isContinuous ? "continuous" : "normal",
        preset,
        sequence: nextSequence,
        startedAt: timestamp,
        updatedAt: timestamp,
        autoStopAt,
        params,
        video: {
          active: isVideo,
          file: isVideo ? file : state.glitch.video?.file || null,
          src: isVideo ? glitchVideoSrc(file) : state.glitch.video?.src || null,
          loop: Boolean(payload.loop),
          takeover: isVideo,
          transitionMs
        }
      };

      if (durationMs) {
        scheduleGlitchStop(durationMs, nextSequence);
      }

      logPerformance({
        type: isVideo ? "GLITCH_VIDEO" : isContinuous ? "GLITCH_CONTINUOUS" : "GLITCH_TRIGGER",
        source,
        public: true,
        preset,
        videoFile: state.glitch.video.file,
        durationMs
      });
      emit({ type: "glitch", glitch: publicGlitchSnapshot(state.glitch) });
      return { applied: true, state: publicGlitchSnapshot(state.glitch) };
    }

    return {
      applied: false,
      error: "GLITCH ACTION UNKNOWN",
      state: publicGlitchSnapshot(state.glitch)
    };
  }

  function controlDisplayBlackout(target, enabled = true, { source = "operator" } = {}) {
    const normalizedTarget = normalizeDisplayBlackoutTarget(target);

    if (!normalizedTarget) {
      return {
        applied: false,
        error: "BLACKOUT TARGET UNKNOWN",
        state: publicDisplayBlackoutSnapshot(state.displayBlackout)
      };
    }

    const targets = { ...state.displayBlackout.targets };
    const currentValue = normalizedTarget === "all"
      ? Object.values(targets).some(Boolean)
      : Boolean(targets[normalizedTarget]);
    const nextEnabled = enabled === "toggle" ? !currentValue : Boolean(enabled);

    if (normalizedTarget === "all") {
      for (const targetId of displayBlackoutTargetIds()) {
        targets[targetId] = nextEnabled;
      }
    } else {
      targets[normalizedTarget] = nextEnabled;
    }

    state.displayBlackout = {
      targets,
      updatedAt: new Date().toISOString(),
      updatedBy: source,
      sequence: (state.displayBlackout.sequence || 0) + 1
    };

    logPerformance({
      type: "DISPLAY_BLACKOUT",
      source,
      public: true,
      target: normalizedTarget,
      enabled: nextEnabled
    });

    setTimeout(() => {
      emit({ type: "display-blackout", displayBlackout: publicDisplayBlackoutSnapshot(state.displayBlackout) });
    }, 0);

    return {
      applied: true,
      target: normalizedTarget,
      enabled: nextEnabled,
      state: publicDisplayBlackoutSnapshot(state.displayBlackout)
    };
  }

  function emitSceneCue(type = "scene-cue") {
    emit({ type, sceneCue: publicSceneCueSnapshot(state.sceneCue) });
  }

  function triggerSceneCue({ controllerId, cue, source = "controller" } = {}) {
    const normalizedControllerId = `${controllerId || ""}`.trim();

    if (!normalizedControllerId || !cue) {
      return { applied: false, error: "SCENE CUE INVALID", state: publicSceneCueSnapshot(state.sceneCue) };
    }

    clearSceneCueTimers();
    const normalizedCue = normalizeSceneCue(cue);
    const sequence = (state.sceneCue.sequence || 0) + 1;
    const triggeredAt = new Date().toISOString();
    const clearAt = normalizedCue.durationMs > 0
      ? new Date(Date.now() + normalizedCue.durationMs).toISOString()
      : null;

    state.sceneCue = {
      controllerId: normalizedControllerId,
      cue: normalizedCue,
      triggeredAt,
      clearAt,
      sequence
    };
    emitSceneCue();

    if (normalizedCue.durationMs > 0) {
      const timer = setTimeout(() => {
        sceneCueTimers.delete(timer);

        if (state.sceneCue.sequence !== sequence) {
          return;
        }

        state.sceneCue = {
          ...createInitialSceneCueState(),
          sequence
        };
        emitSceneCue("scene-cue-stop");
      }, normalizedCue.durationMs);

      sceneCueTimers.add(timer);
    }

    logPerformance({
      type: "SCENE_CUE",
      source,
      public: true,
      controllerId: normalizedControllerId,
      cueId: normalizedCue.id,
      action: "play"
    });

    return { applied: true, state: publicSceneCueSnapshot(state.sceneCue) };
  }

  function stopSceneCue({ controllerId, cueId, source = "controller" } = {}) {
    const activeCue = state.sceneCue.cue;
    const matchesActiveCue = activeCue
      && state.sceneCue.controllerId === `${controllerId || ""}`.trim()
      && (!cueId || activeCue.id === cueId);

    if (!matchesActiveCue) {
      return { applied: true, stopped: false, state: publicSceneCueSnapshot(state.sceneCue) };
    }

    clearSceneCueTimers();
    state.sceneCue = {
      ...createInitialSceneCueState(),
      sequence: state.sceneCue.sequence || 0
    };
    emitSceneCue("scene-cue-stop");

    logPerformance({
      type: "SCENE_CUE",
      source,
      public: true,
      controllerId: `${controllerId || ""}`.trim(),
      cueId: activeCue.id,
      action: "stop"
    });

    return { applied: true, stopped: true, state: publicSceneCueSnapshot(state.sceneCue) };
  }

  function registerProjectionWindow({ id, path, userAgent = null } = {}) {
    const projectionWindowId = `${id || nextProjectionWindowId(state.projection.windows)}`.trim();
    const currentPath = normalizeProjectionPath(path);
    const screen = getProjectionScreenByPath(currentPath);

    if (!screen) {
      return { applied: false, error: "PROJECTION ROUTE INVALID", state: publicProjectionSnapshot(state.projection) };
    }

    const timestamp = new Date().toISOString();
    const existing = state.projection.windows[projectionWindowId] || {};

    state.projection.windows[projectionWindowId] = {
      id: projectionWindowId,
      createdAt: existing.createdAt || timestamp,
      connectedAt: existing.connectedAt || timestamp,
      lastHeartbeatAt: timestamp,
      disconnectedAt: null,
      connected: true,
      currentPath,
      currentLabel: screen.label,
      userAgent: userAgent || existing.userAgent || null
    };
    state.projection.activeProjectionWindowId = projectionWindowId;

    emit({ type: "projection:register", projection: publicProjectionSnapshot(state.projection), projectionWindowId });
    return { applied: true, projectionWindowId, state: publicProjectionSnapshot(state.projection) };
  }

  function heartbeatProjectionWindow({ id, path } = {}) {
    const projectionWindowId = `${id || ""}`.trim();
    const existing = state.projection.windows[projectionWindowId];

    if (!projectionWindowId || !existing) {
      return { applied: false, error: "PROJECTION WINDOW UNKNOWN", state: publicProjectionSnapshot(state.projection) };
    }

    const currentPath = normalizeProjectionPath(path || existing.currentPath);
    const screen = getProjectionScreenByPath(currentPath);

    if (!screen) {
      return { applied: false, error: "PROJECTION ROUTE INVALID", state: publicProjectionSnapshot(state.projection) };
    }

    state.projection.windows[projectionWindowId] = {
      ...existing,
      connected: true,
      disconnectedAt: null,
      lastHeartbeatAt: new Date().toISOString(),
      currentPath,
      currentLabel: screen.label
    };

    emit({ type: "projection:heartbeat", projection: publicProjectionSnapshot(state.projection), projectionWindowId });
    return { applied: true, state: publicProjectionSnapshot(state.projection) };
  }

  function disconnectProjectionWindow(id) {
    const projectionWindowId = `${id || ""}`.trim();
    const existing = state.projection.windows[projectionWindowId];

    if (!projectionWindowId || !existing) {
      return { applied: false, error: "PROJECTION WINDOW UNKNOWN", state: publicProjectionSnapshot(state.projection) };
    }

    state.projection.windows[projectionWindowId] = {
      ...existing,
      connected: false,
      disconnectedAt: new Date().toISOString()
    };

    emit({ type: "projection:disconnect", projection: publicProjectionSnapshot(state.projection), projectionWindowId });
    return { applied: true, state: publicProjectionSnapshot(state.projection) };
  }

  function navigateProjectionWindow({ id, path } = {}) {
    const projectionWindowId = `${id || state.projection.activeProjectionWindowId || ""}`.trim();
    const currentPath = normalizeProjectionPath(path);
    const screen = getProjectionScreenByPath(currentPath);
    const projectionWindow = state.projection.windows[projectionWindowId];

    if (!projectionWindowId) {
      return { applied: false, error: "NO ACTIVE PROJECTION WINDOW", state: publicProjectionSnapshot(state.projection) };
    }

    if (!projectionWindow) {
      return { applied: false, error: "PROJECTION WINDOW UNKNOWN", state: publicProjectionSnapshot(state.projection) };
    }

    const projectionSnapshot = publicProjectionSnapshot(state.projection);
    const publicWindow = projectionSnapshot.windows[projectionWindowId];

    if (!publicWindow?.connected) {
      return { applied: false, error: "PROJECTION WINDOW DISCONNECTED", state: projectionSnapshot };
    }

    if (!screen) {
      return { applied: false, error: "PROJECTION ROUTE INVALID", state: projectionSnapshot };
    }

    const command = {
      id: randomUUID(),
      type: "projection:navigate",
      projectionWindowId,
      path: currentPath,
      label: screen.label,
      sequence: (state.projection.commandSequence || 0) + 1,
      createdAt: new Date().toISOString()
    };

    state.projection.commandSequence = command.sequence;
    state.projection.lastCommand = command;
    state.projection.activeProjectionWindowId = projectionWindowId;

    emit({ type: "projection:navigate", projection: publicProjectionSnapshot(state.projection), command });
    return { applied: true, command, state: publicProjectionSnapshot(state.projection) };
  }

  function scheduleQuedaAviaoPlayback() {
    clearQuedaAviaoTimers();

    const snapshot = publicQuedaAviaoSnapshot(state.quedaAviao);

    if (!snapshot.currentSegment) {
      return;
    }

    const sequence = snapshot.playbackSequence;
    const fadeMs = snapshot.fadeMs;
    const holdMs = snapshot.currentSegment.holdMs;

    if (fadeMs <= 0) {
      if (state.quedaAviao.phase !== QUEDA_AVIAO_PHASES.VISIBLE) {
        state.quedaAviao = {
          ...state.quedaAviao,
          phase: QUEDA_AVIAO_PHASES.VISIBLE,
          updatedAt: new Date().toISOString()
        };
        emitQuedaAviao();
      }

      if (!snapshot.autoPlay) {
        return;
      }

      scheduleQuedaAviaoTimer(() => {
        if (state.quedaAviao.playbackSequence !== sequence || !state.quedaAviao.autoPlay) {
          return;
        }

        state.quedaAviao = advanceQuedaAviao(state.quedaAviao, 1);
        emitQuedaAviao();
        scheduleQuedaAviaoPlayback();
      }, holdMs);
      return;
    }

    if (snapshot.phase === QUEDA_AVIAO_PHASES.ENTERING) {
      scheduleQuedaAviaoTimer(() => {
        if (state.quedaAviao.playbackSequence !== sequence) {
          return;
        }

        state.quedaAviao = {
          ...state.quedaAviao,
          phase: QUEDA_AVIAO_PHASES.VISIBLE,
          updatedAt: new Date().toISOString()
        };
        emitQuedaAviao();
        scheduleQuedaAviaoPlayback();
      }, 30);
      return;
    }

    if (!snapshot.autoPlay) {
      return;
    }

    if (snapshot.phase === QUEDA_AVIAO_PHASES.VISIBLE) {
      scheduleQuedaAviaoTimer(() => {
        if (state.quedaAviao.playbackSequence !== sequence || !state.quedaAviao.autoPlay) {
          return;
        }

        state.quedaAviao = {
          ...state.quedaAviao,
          phase: QUEDA_AVIAO_PHASES.EXITING,
          updatedAt: new Date().toISOString()
        };
        emitQuedaAviao();
        scheduleQuedaAviaoPlayback();
      }, holdMs + fadeMs);
      return;
    }

    scheduleQuedaAviaoTimer(() => {
      if (state.quedaAviao.playbackSequence !== sequence || !state.quedaAviao.autoPlay) {
        return;
      }

      state.quedaAviao = advanceQuedaAviao(state.quedaAviao, 1);
      emitQuedaAviao();
      scheduleQuedaAviaoPlayback();
    }, fadeMs);
  }

  function controlQuedaAviao(action, payload = {}, { source = "controller" } = {}) {
    const normalizedAction = `${action || ""}`.toLowerCase();

    if (normalizedAction === "update") {
      state.quedaAviao = updateQuedaAviaoState(state.quedaAviao, payload);
    } else if (normalizedAction === "play") {
      state.quedaAviao = updateQuedaAviaoState(state.quedaAviao, {
        autoPlay: true,
        phase: state.quedaAviao.fadeMs > 0 ? QUEDA_AVIAO_PHASES.ENTERING : QUEDA_AVIAO_PHASES.VISIBLE
      });
    } else if (normalizedAction === "pause") {
      state.quedaAviao = updateQuedaAviaoState(state.quedaAviao, {
        autoPlay: false,
        phase: QUEDA_AVIAO_PHASES.VISIBLE
      });
    } else if (normalizedAction === "next") {
      state.quedaAviao = advanceQuedaAviao(state.quedaAviao, 1);
    } else if (normalizedAction === "previous" || normalizedAction === "prev") {
      state.quedaAviao = advanceQuedaAviao(state.quedaAviao, -1);
    } else if (normalizedAction === "set-index") {
      state.quedaAviao = setQuedaAviaoIndex(state.quedaAviao, payload.index);
    } else if (normalizedAction === "reset") {
      state.quedaAviao = resetQuedaAviaoState(state.quedaAviao);
    } else {
      return {
        applied: false,
        error: "QUEDA AVIAO ACTION UNKNOWN",
        state: publicQuedaAviaoSnapshot(state.quedaAviao)
      };
    }

    logPerformance({
      type: "QUEDA_AVIAO_CONTROL",
      source,
      public: false,
      action: normalizedAction
    });
    emitQuedaAviao();
    scheduleQuedaAviaoPlayback();

    return {
      applied: true,
      state: publicQuedaAviaoSnapshot(state.quedaAviao)
    };
  }

  function setQuedaAviaoDisplayConnection(connected) {
    state.quedaAviao = setQuedaAviaoDisplayConnectionState(state.quedaAviao, connected);
    emitQuedaAviao("queda-aviao-display");
    scheduleQuedaAviaoPlayback();
    return publicQuedaAviaoSnapshot(state.quedaAviao);
  }

  function scheduleBaralhoMorbidoPhase(phase, delayMs, sequence) {
    const timer = setTimeout(() => {
      baralhoMorbidoTimers.delete(timer);

      if (state.baralhoMorbido.drawSequence !== sequence) {
        return;
      }

      if (!state.baralhoMorbido.currentCard) {
        return;
      }

      const isFinalCard = state.baralhoMorbido.usedIds.length >= state.baralhoMorbido.totalCards;
      const nextPhase = phase === BARALHO_MORBIDO_PHASES.PLAYING && isFinalCard
        ? BARALHO_MORBIDO_PHASES.FINISHED
        : phase;

      state.baralhoMorbido = setBaralhoMorbidoPhase(state.baralhoMorbido, nextPhase);
      emit({ type: "baralho-morbido", baralhoMorbido: publicBaralhoMorbidoSnapshot(state.baralhoMorbido) });
    }, delayMs);

    baralhoMorbidoTimers.add(timer);
  }

  function scheduleBaralhoMorbidoTimeline(sequence) {
    clearBaralhoMorbidoTimers();
    scheduleBaralhoMorbidoPhase(BARALHO_MORBIDO_PHASES.SELECTING, BARALHO_MORBIDO_TIMELINE_MS.selecting, sequence);
    scheduleBaralhoMorbidoPhase(BARALHO_MORBIDO_PHASES.REVEALING, BARALHO_MORBIDO_TIMELINE_MS.revealing, sequence);
    scheduleBaralhoMorbidoPhase(BARALHO_MORBIDO_PHASES.PLAYING, BARALHO_MORBIDO_TIMELINE_MS.playing, sequence);
  }

  function drawBaralhoMorbidoCard({ source = "controller" } = {}) {
    const result = drawBaralhoMorbidoCardState(state.baralhoMorbido);
    state.baralhoMorbido = result.state;

    if (result.applied) {
      logPerformance({
        type: "BARALHO_MORBIDO_DRAW",
        source,
        public: false,
        cardId: result.card.id,
        sequence: state.baralhoMorbido.drawSequence,
        usedIds: state.baralhoMorbido.usedIds
      });
      scheduleBaralhoMorbidoTimeline(state.baralhoMorbido.drawSequence);
      emit({ type: "baralho-morbido", baralhoMorbido: publicBaralhoMorbidoSnapshot(state.baralhoMorbido) });
    } else if (result.reason === "finished") {
      clearBaralhoMorbidoTimers();
      emit({ type: "baralho-morbido", baralhoMorbido: publicBaralhoMorbidoSnapshot(state.baralhoMorbido) });
    }

    return {
      ...result,
      state: publicBaralhoMorbidoSnapshot(state.baralhoMorbido)
    };
  }

  function resetBaralhoMorbido({ source = "controller" } = {}) {
    clearBaralhoMorbidoTimers();
    const displayConnectionState = {
      displayConnections: state.baralhoMorbido.displayConnections || 0,
      displayConnectedAt: state.baralhoMorbido.displayConnectedAt || null,
      displayDisconnectedAt: state.baralhoMorbido.displayDisconnectedAt || null
    };
    state.baralhoMorbido = {
      ...createInitialBaralhoMorbidoState(),
      ...displayConnectionState,
      lastEvent: {
        type: "reset",
        source,
        timestamp: new Date().toISOString()
      }
    };

    logPerformance({
      type: "BARALHO_MORBIDO_RESET",
      source,
      public: false
    });
    emit({ type: "baralho-morbido", baralhoMorbido: publicBaralhoMorbidoSnapshot(state.baralhoMorbido) });
    return publicBaralhoMorbidoSnapshot(state.baralhoMorbido);
  }

  function setBaralhoMorbidoDisplayConnection(connected) {
    const nextConnections = connected
      ? (state.baralhoMorbido.displayConnections || 0) + 1
      : Math.max(0, (state.baralhoMorbido.displayConnections || 0) - 1);

    state.baralhoMorbido = {
      ...state.baralhoMorbido,
      displayConnections: nextConnections,
      displayConnectedAt: connected ? new Date().toISOString() : state.baralhoMorbido.displayConnectedAt,
      displayDisconnectedAt: connected ? state.baralhoMorbido.displayDisconnectedAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    emit({ type: "baralho-morbido-display", baralhoMorbido: publicBaralhoMorbidoSnapshot(state.baralhoMorbido) });
    return publicBaralhoMorbidoSnapshot(state.baralhoMorbido);
  }

  function addMemory(content) {
    const memory = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      source: "operator",
      type: "memory",
      content
    };

    state.memories.push(memory);

    const inferredPresence = presenceFromMemory(content);
    const inferredParticipants = inferSessionParticipantsFromMemory(content);
    const savedAudienceParticipants = saveAudienceParticipants(inferredParticipants);

    memory.participants = {
      inferred: inferredParticipants,
      savedToPublico: savedAudienceParticipants
    };

    for (const name of inferredParticipants) {
      state.participants.session = addParticipantToSession(state.participants.session, name, {
        present: inferredPresence,
        lastSeenAt: memory.timestamp,
        firstSeenAt: memory.timestamp
      });
    }

    emit({ type: "memory", memory });
    return memory;
  }

  function addMessage(role, content, source = "projection") {
    const message = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      role,
      source,
      content
    };

    state.conversation.push(message);
    emit({ type: "message", message });
    return message;
  }

  function queuePerformanceEvents(events = [], source = "agent") {
    const normalized = normalizePerformanceEvents(events, source);

    if (!normalized.length) {
      return [];
    }

    const interrupting = normalized.some((event) => event.interrupt);
    if (interrupting) {
      state.performance.events = state.performance.events.filter((event) => event.status !== "queued");
    }

    state.performance.events.push(...normalized);
    state.performance.events = state.performance.events.slice(-80);

    for (const event of normalized) {
      if (event.type === "PHONE_PROJECTION_REQUEST") {
        state.performance.phoneProjection = {
          status: "pending_operator_confirmation",
          participant: event.payload.participant || null,
          contentType: event.payload.contentType || null,
          privacyLevel: event.payload.privacyLevel || "high",
          requestedAt: new Date().toISOString(),
          approvedAt: null,
          hiddenAt: null
        };
      }

      if (event.type === "HIDE_PHONE_PROJECTION") {
        state.performance.phoneProjection = {
          ...state.performance.phoneProjection,
          status: "hidden",
          hiddenAt: new Date().toISOString()
        };
      }

      logPerformance({
        type: "PERFORMANCE_EVENT_QUEUED",
        eventType: event.type,
        eventId: event.id,
        source,
        public: true,
        payload: event.payload,
        durationMs: event.durationMs,
        trigger: event.trigger
      });
    }

    emit({ type: "performance-events", events: normalized });
    return normalized;
  }

  function approvePhoneProjection() {
    state.performance.phoneProjection = {
      ...state.performance.phoneProjection,
      status: "approved",
      approvedAt: new Date().toISOString()
    };

    const logEntry = logPerformance({
      type: "PHONE_PROJECTION_APPROVED",
      source: "operator",
      public: false,
      phoneProjection: state.performance.phoneProjection
    });
    emit({ type: "phone-projection", phoneProjection: state.performance.phoneProjection, logEntry });
    return state.performance.phoneProjection;
  }

  function hidePhoneProjection() {
    const queued = queuePerformanceEvents([{ type: "HIDE_PHONE_PROJECTION", durationMs: 100 }], "operator");
    const logEntry = logPerformance({
      type: "PHONE_PROJECTION_HIDDEN",
      source: "operator",
      public: false,
      phoneProjection: state.performance.phoneProjection
    });
    emit({ type: "phone-projection", phoneProjection: state.performance.phoneProjection, logEntry });
    return { queued, phoneProjection: state.performance.phoneProjection };
  }

  function completePerformanceEvent(eventId, action = "completed") {
    const index = state.performance.events.findIndex((event) => event.id === eventId);

    if (index === -1) {
      return { completed: false, event: null };
    }

    const [event] = state.performance.events.splice(index, 1);
    const completedEvent = {
      ...event,
      status: "completed",
      completedAt: new Date().toISOString(),
      completionAction: action
    };

    const logEntry = logPerformance({
      type: "PERFORMANCE_EVENT_COMPLETED",
      eventType: completedEvent.type,
      eventId: completedEvent.id,
      action,
      source: "projection",
      public: false
    });
    emit({ type: "performance-event-completed", event: completedEvent, logEntry });
    return { completed: true, event: completedEvent };
  }

  function cancelPerformanceEvents({ type = null, reason = "cancelled", source = "system" } = {}) {
    const cancelled = [];
    const remaining = [];

    for (const event of state.performance.events) {
      if (type && event.type !== type) {
        remaining.push(event);
        continue;
      }

      cancelled.push({
        ...event,
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        cancellationReason: reason
      });
    }

    if (!cancelled.length) {
      return { cancelled: [], logEntry: null };
    }

    state.performance.events = remaining;
    const logEntry = logPerformance({
      type: "PERFORMANCE_EVENTS_CANCELLED",
      eventType: type || "ANY",
      eventIds: cancelled.map((event) => event.id),
      reason,
      source,
      public: false
    });

    emit({ type: "performance-events-cancelled", events: cancelled, logEntry });
    return { cancelled, logEntry };
  }

  function clearPerformance({ keepHistory = true } = {}) {
    state.performance.events = [];
    state.performance.interactions = [];
    state.performance.activities = [];
    state.performance.salience = [];
    state.performance.phoneProjection = {
      status: "hidden",
      participant: null,
      contentType: null,
      privacyLevel: null,
      requestedAt: null,
      approvedAt: null,
      hiddenAt: new Date().toISOString()
    };

    if (!keepHistory) {
      state.performance.eventLog = [];
    }

    const logEntry = logPerformance({
      type: "PERFORMANCE_CLEAR",
      source: "operator",
      public: false
    });
    emit({ type: "performance-clear", logEntry });
    return logEntry;
  }

  function addPerformanceInteraction(interaction = {}) {
    const record = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      eventId: interaction.eventId || null,
      activityId: interaction.activityId || null,
      action: interaction.action || "UNKNOWN",
      payload: interaction.payload || {}
    };

    state.performance.interactions.push(record);
    logPerformance({
      type: "PERFORMANCE_INTERACTION",
      eventId: record.eventId,
      activityId: record.activityId,
      action: record.action,
      payload: record.payload,
      public: false
    });
    emit({ type: "performance-interaction", interaction: record });
    return record;
  }

  function addSalience(items = [], source = "agent") {
    const records = items
      .map((item) => ({
        id: randomUUID(),
        text: `${item.text || item || ""}`.slice(0, 120),
        type: item.type || "word",
        origin: item.origin || source,
        createdAt: new Date().toISOString(),
        intensity: Math.min(10, Math.max(1, Number(item.intensity) || 3)),
        reuseCount: 0
      }))
      .filter((item) => item.text);

    if (!records.length) {
      return [];
    }

    state.performance.salience.push(...records);
    state.performance.salience = state.performance.salience.slice(-40);
    for (const record of records) {
      logPerformance({
        type: "SALIENCE_MARKED",
        source,
        text: record.text,
        public: false
      });
    }

    emit({ type: "performance-salience", salience: records });
    return records;
  }

  function updateInstagram(nextInstagram = {}) {
    const timestamp = new Date().toISOString();
    const message = nextInstagram.message || state.instagram.message || "";

    state.instagram = {
      ...state.instagram,
      ...nextInstagram,
      updatedAt: timestamp
    };

    if (message) {
      const logEntry = {
        id: randomUUID(),
        timestamp,
        status: state.instagram.status,
        message,
        currentUrl: state.instagram.currentUrl || null,
        lastAction: state.instagram.lastAction || null,
        targetProfile: state.instagram.targetProfile || null,
        lastButtonState: state.instagram.lastButtonState || null
      };

      state.instagram.logs.push(logEntry);
      state.instagram.logs = state.instagram.logs.slice(-80);

      logPerformance({
        type: "INSTAGRAM_STATUS",
        source: "instagram",
        public: false,
        status: logEntry.status,
        action: logEntry.lastAction,
        targetProfile: logEntry.targetProfile,
        buttonState: logEntry.lastButtonState,
        text: message
      });
    }

    emit({ type: "instagram", instagram: state.instagram });
    return { ...state.instagram, logs: [...state.instagram.logs].slice(-20) };
  }

  function setPerformanceIntensity(intensity) {
    const allowed = new Set(["calm", "playful", "strange", "chaotic"]);
    state.performance.intensity = allowed.has(intensity) ? intensity : "calm";
    const logEntry = logPerformance({
      type: "PERFORMANCE_INTENSITY",
      intensity: state.performance.intensity,
      source: "operator",
      public: false
    });
    emit({ type: "performance-intensity", intensity: state.performance.intensity, logEntry });
    return state.performance.intensity;
  }

  function startHangmanActivity({ word, source = "operator" } = {}) {
    const activity = createHangmanActivity({ word, source });
    state.performance.activities.push(activity);
    logPerformance({
      type: "ACTIVITY_START",
      activityType: activity.type,
      activityId: activity.id,
      source,
      public: false,
      secret: activity.privateState.secretWord,
      publicState: activity.publicState
    });
    emit({ type: "activity-start", activity: publicActivitySnapshot(activity) });
    return activity;
  }

  function updateActivity(nextActivity, { source = "agent", result = null } = {}) {
    const index = state.performance.activities.findIndex((activity) => activity.id === nextActivity.id);

    if (index === -1) {
      return null;
    }

    state.performance.activities[index] = nextActivity;
    logPerformance({
      type: "ACTIVITY_UPDATE",
      activityType: nextActivity.type,
      activityId: nextActivity.id,
      source,
      public: false,
      result,
      publicState: nextActivity.publicState,
      status: nextActivity.status
    });
    emit({ type: "activity-update", activity: publicActivitySnapshot(nextActivity) });
    return nextActivity;
  }

  function stopActivities(status = "abandoned") {
    state.performance.activities = state.performance.activities.map((activity) => ({
      ...activity,
      status,
      updatedAt: new Date().toISOString()
    }));
    const logEntry = logPerformance({
      type: "ACTIVITY_STOP",
      status,
      source: "operator",
      public: false
    });
    emit({ type: "activity-stop", logEntry });
    return logEntry;
  }

  function applySuitcaseResult(result, { source = "system", queueEvents = true } = {}) {
    state.suitcase = result.state;

    if (result.result || result.events?.length) {
      logPerformance({
        type: "SUITCASE_EVENT",
        source,
        public: false,
        experience: state.suitcase.activeExperience,
        gameType: state.suitcase.gameType,
        action: result.result?.type || "state_change",
        userInput: state.suitcase.lastUserInput,
        visualActions: result.events || [],
        stateAfter: {
          phase: state.suitcase.phase,
          activeExperience: state.suitcase.activeExperience,
          gameType: state.suitcase.gameType,
          selectedSuitcase: state.suitcase.selectedSuitcase,
          result: state.suitcase.result
        },
        selectedInstagramPerson: state.suitcase.instagram?.selectedPerson?.id || null,
        selectedMiniGame: state.suitcase.currentGame?.id || null,
        questionCount: state.suitcase.guessWho?.questionCount || null,
        guesses: state.suitcase.guessWho?.guesses || null,
        result: state.suitcase.result
      });
    }

    if (queueEvents && result.events?.length) {
      queuePerformanceEvents(result.events, "suitcase");
    }

    emit({ type: "suitcase", suitcase: publicSuitcaseSnapshot(state.suitcase) });
    return {
      ...result,
      state: publicSuitcaseSnapshot(state.suitcase)
    };
  }

  function startSuitcases({ source = "operator" } = {}) {
    return applySuitcaseResult(startSuitcasesState(state.suitcase, { source }), { source });
  }

  function advanceSuitcases(input, { source = "public" } = {}) {
    return applySuitcaseResult(advanceSuitcasesState(state.suitcase, input), { source });
  }

  function applySuitcaseMove(move = {}, { source = "agent" } = {}) {
    return applySuitcaseResult(applySuitcaseMoveState(state.suitcase, move), { source });
  }

  function abortSuitcases({ source = "operator" } = {}) {
    return applySuitcaseResult(abortSuitcasesState(state.suitcase, { source }), { source });
  }

  function resetSuitcases({ source = "operator" } = {}) {
    return applySuitcaseResult(resetSuitcasesState(state.suitcase, { source }), { source });
  }

  function forceSuitcaseExperience(experience, { source = "operator", requestedGame = null } = {}) {
    return applySuitcaseResult(forceSuitcaseExperienceState(state.suitcase, experience, { source, requestedGame }), { source });
  }

  function finishSuitcases(result = "finished", { source = "operator" } = {}) {
    return applySuitcaseResult(finishSuitcasesState(state.suitcase, result, { source }), { source });
  }

  function nextInstagramPerson({ source = "operator" } = {}) {
    return applySuitcaseResult(forceSuitcaseExperienceState(state.suitcase, "instagram", { source, nextPerson: true }), { source });
  }

  function finishInstagramTimer() {
    return applySuitcaseResult(finishInstagramTimerState(state.suitcase), { source: "timer" });
  }

  function startGame({ requestedGame = null, source = "operator", replace = false } = {}) {
    const result = startGameState(privateSnapshot(), { requestedGame, source, replace });
    state.game = result.gameState;

    if (!result.blocked && state.game.active) {
      state.participants.history = markParticipantsSelected(
        state.participants.history,
        result.participants || state.game.participants || [],
        state.game.startedAt
      );

      logPerformance({
        ...createGameLogEntry(state.game),
        source,
        public: false
      });

      if (result.events.length) {
        queuePerformanceEvents(result.events, "game");
      }
    }

    emit({ type: "game-start", game: publicGameSnapshot(state.game) });
    return {
      ...result,
      gameState: publicGameSnapshot(state.game)
    };
  }

  function setGameSecret(secret, { source = "operator" } = {}) {
    const result = setGameSecretState(privateSnapshot(), secret);
    state.game = result.gameState;

    if (result.applied) {
      logPerformance({
        type: "GAME_SECRET_SET",
        gameId: state.game.id,
        phase: state.game.phase,
        source,
        public: false
      });
      emit({ type: "game-secret", game: publicGameSnapshot(state.game) });
    }

    return {
      ...result,
      gameState: publicGameSnapshot(state.game)
    };
  }

  function stopGame({ status = "stopped", source = "operator" } = {}) {
    const result = stopGameState(privateSnapshot(), { status, source });
    state.game = result.gameState;
    logPerformance({
      type: "GAME_STOP",
      gameId: state.game.id,
      status,
      source,
      public: false
    });
    emit({ type: "game-stop", game: publicGameSnapshot(state.game) });
    return {
      ...result,
      gameState: publicGameSnapshot(state.game)
    };
  }

  function advanceGame(input, { source = "public" } = {}) {
    const wasActive = state.game.active;
    const result = advanceGameState(privateSnapshot(), input);
    state.game = result.gameState;

    if (wasActive && !state.game.active) {
      state.game = stopGameState({ ...privateSnapshot(), game: state.game }, {
        status: result.result?.completed ? "completed" : "stopped",
        source
      }).gameState;
    }

    logPerformance({
      type: "GAME_ADVANCE",
      gameId: state.game.id,
      phase: state.game.phase,
      source,
      result: result.result,
      public: false
    });

    if (result.events.length) {
      queuePerformanceEvents(result.events, "game");
    }

    emit({ type: "game-advance", game: publicGameSnapshot(state.game) });
    return {
      ...result,
      gameState: publicGameSnapshot(state.game)
    };
  }

  function completeTurnGameTick() {
    const previousGame = state.game;
    state.game = tickGameAfterTurn(privateSnapshot());

    const previousWasDrawingGame = previousGame?.active && (
      previousGame.id === "draw_and_guess" || previousGame.id === "pictionary_teams"
    );
    if (previousWasDrawingGame && !state.game.active) {
      queuePerformanceEvents([{ type: "CLEAR_DRAWING", durationMs: 100 }], "game");
    }

    emit({ type: "game-tick", game: publicGameSnapshot(state.game) });
    return publicGameSnapshot(state.game);
  }

  function applyGameMove(move = {}, { source = "agent" } = {}) {
    const result = applyGameMoveState(privateSnapshot(), move);
    state.game = result.gameState;

    if (result.applied) {
      logPerformance({
        type: "GAME_MOVE",
        gameId: state.game.id,
        phase: state.game.phase,
        source,
        move,
        public: false
      });
      emit({ type: "game-move", game: publicGameSnapshot(state.game) });
    }

    return {
      ...result,
      gameState: publicGameSnapshot(state.game)
    };
  }

  function controlStructuredGame(action, payload = {}, { source = "operator" } = {}) {
    const result = controlStructuredGameState(privateSnapshot(), action, payload);
    state.game = result.gameState;

    if (result.applied) {
      logPerformance({
        type: "STRUCTURED_GAME_CONTROL",
        gameId: state.game.id,
        phase: state.game.phase,
        action,
        result: result.result,
        source,
        public: false
      });

      if (result.result?.type === "game_result" || result.result?.type === "finished") {
        logPerformance({
          type: "GAME_FINISHED_CALLBACK",
          gameId: state.game.id,
          payload: result.result.payload || {
            game: state.game.publicData?.gameType || state.game.id,
            score: state.game.publicData?.score || 0,
            rounds: state.game.publicData?.roundResults || []
          },
          source,
          public: false
        });
      }

      emit({ type: "structured-game-control", game: publicGameSnapshot(state.game), action, result: result.result });
    }

    return {
      ...result,
      gameState: publicGameSnapshot(state.game)
    };
  }

  function getGameOpportunity(latestInput = "") {
    const opportunity = evaluateGameOpportunity(privateSnapshot(), latestInput);
    state.game = {
      ...state.game,
      lastOpportunity: opportunity
    };
    return opportunity;
  }

  function setMode(mode) {
    const previousMode = state.mode;
    state.previousMode = previousMode;
    state.mode = mode;
    state.modeStartedAt = new Date().toISOString();

    const modeChange = {
      previousMode,
      mode: state.mode,
      modeStartedAt: state.modeStartedAt
    };

    emit({ type: "mode", modeChange });
    return modeChange;
  }

  function setModel(model) {
    const nextModel = resolveOpenAIModel(model, state.model);
    const previousModel = state.model;
    state.model = nextModel;

    const modelChange = {
      previousModel,
      model: state.model
    };

    emit({ type: "model", modelChange });
    return modelChange;
  }

  function reset() {
    state.memories = [];
    state.conversation = [];
    state.mode = DEFAULT_SHOW_MODE;
    state.previousMode = null;
    state.modeStartedAt = new Date().toISOString();
    state.variables = {};
    state.game = createInitialGameState();
    state.suitcase = createInitialSuitcaseState();
    clearBaralhoMorbidoTimers();
    state.baralhoMorbido = createInitialBaralhoMorbidoState();
    clearQuedaAviaoTimers();
    state.quedaAviao = createInitialQuedaAviaoState();
    clearGlitchTimers();
    state.glitch = createInitialGlitchState();
    state.displayBlackout = createInitialDisplayBlackoutState();
    clearSceneCueTimers();
    state.sceneCue = createInitialSceneCueState();
    state.projection = createInitialProjectionState();
    state.participants = {
      session: [],
      history: {}
    };
    state.instagram = {
      ...state.instagram,
      status: "DISCONNECTED",
      message: "reset",
      lastError: null,
      lastButtonState: null,
      currentUrl: null,
      lastAction: null,
      targetProfile: null,
      audioMuted: true,
      updatedAt: new Date().toISOString(),
      logs: []
    };
    state.performance.events = [];
    state.performance.interactions = [];
    state.performance.activities = [];
    state.performance.salience = [];
    state.performance.phoneProjection = {
      status: "hidden",
      participant: null,
      contentType: null,
      privacyLevel: null,
      requestedAt: null,
      approvedAt: null,
      hiddenAt: new Date().toISOString()
    };
    emit({ type: "reset" });
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    addMemory,
    addMessage,
    addPerformanceInteraction,
    addSalience,
    advanceGame,
    advanceSuitcases,
    applyGameMove,
    applySuitcaseMove,
    abortSuitcases,
    approvePhoneProjection,
    cancelPerformanceEvents,
    completeTurnGameTick,
    controlStructuredGame,
    controlQuedaAviao,
    controlGlitch,
    controlDisplayBlackout,
    disconnectProjectionWindow,
    clearPerformance,
    completePerformanceEvent,
    drawBaralhoMorbidoCard,
    finishInstagramTimer,
    finishSuitcases,
    forceSuitcaseExperience,
    getGameOpportunity,
    hidePhoneProjection,
    nextInstagramPerson,
    heartbeatProjectionWindow,
    privateSnapshot,
    queuePerformanceEvents,
    reset,
    resetBaralhoMorbido,
    resetQuedaAviao: () => {
      state.quedaAviao = resetQuedaAviaoState(state.quedaAviao);
      emitQuedaAviao();
      scheduleQuedaAviaoPlayback();
      return publicQuedaAviaoSnapshot(state.quedaAviao);
    },
    resetSuitcases,
    navigateProjectionWindow,
    registerProjectionWindow,
    setBaralhoMorbidoDisplayConnection,
    setQuedaAviaoDisplayConnection,
    setMode,
    setModel,
    setGameSecret,
    setPerformanceIntensity,
    snapshot,
    startGame,
    startHangmanActivity,
    startSuitcases,
    stopSceneCue,
    stopGame,
    stopActivities,
    subscribe,
    triggerSceneCue,
    updateInstagram,
    updateActivity
  };
}

export const showState = globalThis[globalKey]?.startGame && globalThis[globalKey]?.controlStructuredGame && globalThis[globalKey]?.cancelPerformanceEvents && globalThis[globalKey]?.startSuitcases && globalThis[globalKey]?.updateInstagram && globalThis[globalKey]?.drawBaralhoMorbidoCard && globalThis[globalKey]?.controlQuedaAviao && globalThis[globalKey]?.controlGlitch && globalThis[globalKey]?.controlDisplayBlackout && globalThis[globalKey]?.triggerSceneCue && globalThis[globalKey]?.stopSceneCue && globalThis[globalKey]?.registerProjectionWindow
  ? globalThis[globalKey]
  : createStore();

globalThis[globalKey] = showState;
