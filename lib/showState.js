import { randomUUID } from "crypto";
import { createHangmanActivity } from "@/lib/activities";
import {
  BARALHO_MORBIDO_PHASES,
  BARALHO_MORBIDO_TIMELINE_MS,
  createInitialBaralhoMorbidoState,
  drawBaralhoMorbidoCard as drawBaralhoMorbidoCardState,
  publicBaralhoMorbidoSnapshot,
  setBaralhoMorbidoPhase,
  syncBaralhoMorbidoCards as syncBaralhoMorbidoCardsState
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
  glitchAudioForPreset,
  glitchVideoSrc,
  normalizeGlitchParams,
  presetParams,
  publicGlitchSnapshot
} from "@/lib/glitch/state";
import {
  createInitialRobotSoundState,
  normalizeRobotSoundSettings,
  publicRobotSoundSnapshot
} from "@/lib/robot-sound/state";
import {
  normalizeSceneAudioEffects
} from "@/lib/sceneAudioEffects";
import {
  createInitialForcaGSamplerState,
  publicForcaGSamplerSnapshot,
  reduceForcaGSamplerState
} from "@/lib/forca-g-sampler/state";
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
import { resolveEmbeddedPanelVisible } from "@/lib/instagram/panelState";
import { normalizePerformanceEvents } from "@/lib/performanceEvents";
import { getProjectionScreenByPath, normalizeProjectionPath } from "@/lib/projectionScreens";
import {
  clearResearchCache,
  createInitialResearchState,
  updateResearchSettings
} from "@/lib/research/ResearchDirector";
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
import { sequentialMessageSchedule } from "@/lib/messageTiming";
import { publicGincanaTask, SCENE_ZERO_SUITCASES } from "@/lib/scene-zero/suitcaseGame";
import {
  createInitialSceneZeroState,
  chooseSceneZeroParticipant,
  eligibleSceneZeroParticipants,
  normalizeSceneZeroGlitchLevel,
  normalizeSceneZeroPersonalityDirections,
  normalizeSceneZeroStage,
  publicSceneZeroSnapshot,
  sceneZeroGlitchIndex
} from "@/lib/scene-zero/state";

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
    audioCues: [],
    triggeredAt: null,
    clearAt: null,
    sequence: 0
  };
}

function createInitialForcaGShaderState() {
  return {
    tunnel: false,
    redout: false,
    distortion: false,
    intensity: 55,
    updatedAt: new Date().toISOString(),
    sequence: 0
  };
}

function publicForcaGShaderSnapshot(shaders = createInitialForcaGShaderState()) {
  return {
    tunnel: Boolean(shaders.tunnel),
    redout: Boolean(shaders.redout),
    distortion: Boolean(shaders.distortion),
    intensity: Math.max(0, Math.min(100, Number(shaders.intensity) || 0)),
    updatedAt: shaders.updatedAt || null,
    sequence: Number(shaders.sequence || 0)
  };
}

function publicSceneCueSnapshot(sceneCue = createInitialSceneCueState()) {
  return {
    controllerId: sceneCue.controllerId || null,
    cue: sceneCue.cue ? { ...sceneCue.cue } : null,
    audioCues: Array.isArray(sceneCue.audioCues) ? sceneCue.audioCues.map((cue) => ({ ...cue })) : [],
    triggeredAt: sceneCue.triggeredAt || null,
    clearAt: sceneCue.clearAt || null,
    sequence: Number(sceneCue.sequence || 0)
  };
}

function normalizeSceneCue(cue = {}) {
  const type = ["audio", "video", "image", "text"].includes(cue.type) ? cue.type : "audio";
  const assetPath = `${cue.assetPath || ""}`.trim();

  return {
    id: `${cue.id || randomUUID()}`,
    label: `${cue.label || "Novo Botão"}`.trim() || "Novo Botão",
    type,
    assetPath: assetPath.includes("..") ? "" : assetPath,
    durationMs: Math.max(0, Math.min(Number(cue.durationMs) || 0, 60 * 60 * 1000)),
    loop: Boolean(cue.loop),
    volume: Math.max(0, Math.min(1, Number.isFinite(Number(cue.volume)) ? Number(cue.volume) : 1)),
    audioEffects: normalizeSceneAudioEffects(cue.audioEffects),
    fadeOutMs: Math.max(0, Math.min(10000, Number(cue.fadeOutMs) || 0)),
    fadeOutSequence: Math.max(0, Number(cue.fadeOutSequence) || 0),
    playbackId: `${cue.playbackId || randomUUID()}`,
    color: /^#[0-9a-fA-F]{6}$/.test(`${cue.color || ""}`) ? cue.color : "#ffffff",
    text: `${cue.text || ""}`.slice(0, 12000)
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
  const sceneZeroParticipantTimers = new Set();
  const sceneZeroCollectionTimers = new Set();
  let sceneZeroTimer = null;
  let sceneZeroGincanaTimer = null;
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
    robotSound: createInitialRobotSoundState(),
    globalVolume: 1,
    displayBlackout: createInitialDisplayBlackoutState(),
    sceneCue: createInitialSceneCueState(),
    forcaGShaders: createInitialForcaGShaderState(),
    forcaGSampler: createInitialForcaGSamplerState(),
    projection: createInitialProjectionState(),
    sceneZero: createInitialSceneZeroState(),
    research: createInitialResearchState(),
    participants: {
      session: [],
      history: {}
    },
    instagram: {
      enabled: process.env.INSTAGRAM_ENABLED !== "false",
      embedded: process.env.INSTAGRAM_EMBEDDED !== "false",
      embeddedPanelSequence: 0,
      embeddedPanelVisible: false,
      account: "caixapretabot",
      status: "DISCONNECTED",
      message: "desconectado",
      lastError: null,
      lastButtonState: null,
      currentUrl: null,
      lastAction: null,
      targetProfile: null,
      sessionAuthenticated: false,
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
      robotSound: publicRobotSoundSnapshot(state.robotSound),
      globalVolume: state.globalVolume,
      displayBlackout: publicDisplayBlackoutSnapshot(state.displayBlackout),
      sceneCue: publicSceneCueSnapshot(state.sceneCue),
      forcaGShaders: publicForcaGShaderSnapshot(state.forcaGShaders),
      forcaGSampler: publicForcaGSamplerSnapshot(state.forcaGSampler),
      projection: publicProjectionSnapshot(state.projection),
      sceneZero: publicSceneZeroSnapshot(state.sceneZero),
      research: {
        ...state.research,
        config: { ...state.research.config },
        activity: [...state.research.activity].slice(-40),
        openLoops: [...state.research.openLoops].slice(-40)
      },
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

  function setGlobalVolume(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return state.globalVolume;
    state.globalVolume = Math.max(0, Math.min(1, numeric));
    emit({ type: "global-volume", globalVolume: state.globalVolume });
    return state.globalVolume;
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

  function clearSceneZeroTimer() {
    if (sceneZeroTimer) {
      clearTimeout(sceneZeroTimer);
      sceneZeroTimer = null;
    }
  }

  function clearSceneZeroGincanaTimer() {
    if (sceneZeroGincanaTimer) {
      clearTimeout(sceneZeroGincanaTimer);
      sceneZeroGincanaTimer = null;
    }
  }

  function ensureSceneZeroSuitcaseGame() {
    const defaults = createInitialSceneZeroState().suitcaseGame;
    const current = state.sceneZero.suitcaseGame || {};
    state.sceneZero.suitcaseGame = {
      ...defaults,
      ...current,
      gincana: {
        ...defaults.gincana,
        ...(current.gincana || {}),
        timer: {
          ...defaults.gincana.timer,
          ...(current.gincana?.timer || {})
        }
      },
      instagram: {
        ...defaults.instagram,
        ...(current.instagram || {})
      }
    };
    return state.sceneZero.suitcaseGame;
  }

  function clearSceneZeroParticipantTimers() {
    for (const timer of sceneZeroParticipantTimers) {
      clearTimeout(timer);
    }
    sceneZeroParticipantTimers.clear();
  }

  function clearSceneZeroCollectionTimers() {
    for (const timer of sceneZeroCollectionTimers) {
      clearTimeout(timer);
    }
    sceneZeroCollectionTimers.clear();
  }

  function scheduleSceneZeroParticipantAction(callback, delayMs) {
    const timer = setTimeout(() => {
      sceneZeroParticipantTimers.delete(timer);
      callback();
    }, Math.max(0, delayMs));
    sceneZeroParticipantTimers.add(timer);
  }

  function scheduleSceneZeroCollectionAction(callback, delayMs) {
    const timer = setTimeout(() => {
      sceneZeroCollectionTimers.delete(timer);
      callback();
    }, Math.max(0, delayMs));
    sceneZeroCollectionTimers.add(timer);
  }

  function emitSceneZero(type = "scene-zero") {
    emit({ type, sceneZero: publicSceneZeroSnapshot(state.sceneZero) });
  }

  function appendSceneZeroAction(action, detail = "") {
    const entry = {
      id: randomUUID(),
      action,
      detail: `${detail || ""}`.slice(0, 240),
      timestamp: new Date().toISOString()
    };
    state.sceneZero.lastOperatorAction = action;
    state.sceneZero.recentActions = [...(state.sceneZero.recentActions || []), entry].slice(-20);
    return entry;
  }

  function collectionObedienceFromQuestions(questions = []) {
    return questions.reduce((totals, question) => {
      if (!question?.answeredAt) return totals;
      const observation = `${question.observation || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (question.result && !["none", "qualitative"].includes(question.result)) totals.answered += 1;
      if (question.result === "none" || /resist|nao obedec|recus/.test(observation)) totals.resisted += 1;
      if (/demor|hesit/.test(observation)) totals.delayed += 1;
      if (/confus|nao entender/.test(observation)) totals.confused += 1;
      if (/antecip|antes de (eu |o robo |a maquina )?(pedir|terminar)|ja estavam/.test(observation)) totals.anticipated += 1;
      return totals;
    }, { answered: 0, resisted: 0, delayed: 0, confused: 0, anticipated: 0 });
  }

  function selectSceneZeroParticipant({ chooseAnother = false } = {}) {
    if (state.sceneZero.currentParticipant && !chooseAnother) {
      return state.sceneZero.currentParticipant;
    }

    const pool = getParticipantPool({
      sessionParticipants: state.participants.session,
      history: state.participants.history
    }).participants;
    const selected = chooseSceneZeroParticipant(
      pool,
      chooseAnother ? state.sceneZero.currentParticipant : null
    );
    if (!selected) return null;
    state.sceneZero.currentParticipant = { ...selected };
    state.sceneZero.participantSelectionArmed = false;
    state.participants.history = markParticipantsSelected(state.participants.history, [selected]);
    return state.sceneZero.currentParticipant;
  }

  function prepareSceneZeroParticipantSelection({ chooseAnother = false } = {}) {
    clearSceneZeroParticipantTimers();
    const pool = getParticipantPool({
      sessionParticipants: state.participants.session,
      history: state.participants.history
    }).participants;
    const candidates = eligibleSceneZeroParticipants(pool);
    const pendingWinner = chooseSceneZeroParticipant(
      candidates,
      chooseAnother ? state.sceneZero.currentParticipant : null
    );

    if (!pendingWinner) {
      return { applied: false, error: "SCENE ZERO PARTICIPANT POOL EMPTY", state: publicSceneZeroSnapshot(state.sceneZero) };
    }

    state.sceneZero.participantSelectionArmed = true;
    state.sceneZero.participantSelection = {
      status: "preparing",
      candidates: candidates.map((participant) => ({ ...participant })),
      pendingWinner: { ...pendingWinner },
      preparedComments: [],
      preparedAnnouncement: null,
      countdownEndsAt: null,
      rouletteStartedAt: null,
      rouletteEndsAt: null,
      selectedAt: null,
      lastComment: null,
      sequence: (state.sceneZero.participantSelection?.sequence || 0) + 1
    };
    appendSceneZeroAction(chooseAnother ? "participant-selection-restart" : "participant-selection-prepare");
    emitSceneZero("scene-zero-participant-preparing");
    return {
      applied: true,
      winner: { ...pendingWinner },
      candidates: candidates.map((participant) => ({ ...participant })),
      state: publicSceneZeroSnapshot(state.sceneZero)
    };
  }

  function beginSceneZeroParticipantCountdown(sequence) {
    const selection = state.sceneZero.participantSelection;
    if (selection?.sequence !== sequence || selection.status !== "awaiting_invite") return false;

    const countdownEndsAt = new Date(Date.now() + 10000).toISOString();
    state.sceneZero.participantSelection = {
      ...selection,
      status: "countdown",
      countdownEndsAt,
      inviteFallbackAt: null
    };
    appendSceneZeroAction("participant-countdown-start");
    emitSceneZero("scene-zero-participant-countdown");

    scheduleSceneZeroParticipantAction(() => {
      const current = state.sceneZero.participantSelection;
      if (current.sequence !== sequence || current.status !== "countdown") return;

      const rouletteStartedAt = new Date();
      const rouletteComments = current.preparedComments || [];
      const commentSchedule = sequentialMessageSchedule(rouletteComments);
      const rouletteDurationMs = Math.max(7000, commentSchedule.totalDurationMs + 700);
      state.sceneZero.participantSelection = {
        ...current,
        status: "roulette",
        countdownEndsAt: null,
        rouletteStartedAt: rouletteStartedAt.toISOString(),
        rouletteEndsAt: new Date(rouletteStartedAt.getTime() + rouletteDurationMs).toISOString()
      };
      appendSceneZeroAction("participant-roulette-start");
      emitSceneZero("scene-zero-participant-roulette");

      rouletteComments.forEach((comment, index) => {
        scheduleSceneZeroParticipantAction(() => {
          const active = state.sceneZero.participantSelection;
          if (active.sequence !== sequence || active.status !== "roulette") return;
          state.sceneZero.participantSelection = { ...active, lastComment: comment };
          addMessage("assistant", comment, "scene-zero-roulette");
          emitSceneZero("scene-zero-participant-comment");
        }, commentSchedule.offsets[index]);
      });

      scheduleSceneZeroParticipantAction(() => {
        const active = state.sceneZero.participantSelection;
        if (active.sequence !== sequence || active.status !== "roulette") return;
        const winner = active.pendingWinner;
        state.sceneZero.currentParticipant = { ...winner };
        state.sceneZero.participantSelectionArmed = false;
        state.participants.history = markParticipantsSelected(state.participants.history, [winner]);
        state.sceneZero.participantSelection = {
          ...active,
          status: "selected",
          announcement: active.preparedAnnouncement,
          rouletteEndsAt: null,
          selectedAt: new Date().toISOString()
        };
        appendSceneZeroAction("participant-selected", winner.name);
        if (active.preparedAnnouncement) {
          addMessage("assistant", active.preparedAnnouncement, "scene-zero-roulette");
        }
        emitSceneZero("scene-zero-participant-selected");

        scheduleSceneZeroParticipantAction(() => {
          const selected = state.sceneZero.participantSelection;
          if (selected.sequence !== sequence || selected.status !== "selected") return;
          state.sceneZero.participantSelection = { ...selected, status: "complete" };
          emitSceneZero("scene-zero-participant-complete");
        }, 5000);
      }, rouletteDurationMs);
    }, 10000);

    return true;
  }

  function startSceneZeroParticipantSelection({ invite = "", comments = [], announcement = "", inviteMessageId = null } = {}) {
    const selection = state.sceneZero.participantSelection;
    if (selection?.status !== "preparing" || !selection.pendingWinner) {
      return { applied: false, error: "SCENE ZERO PARTICIPANT SELECTION NOT PREPARED", state: publicSceneZeroSnapshot(state.sceneZero) };
    }

    const sequence = selection.sequence;
    const normalizedInvite = `${invite || ""}`.trim();
    const fallbackDelayMs = Math.max(20000, (normalizedInvite.length * 42) + 8000);
    state.sceneZero.participantSelection = {
      ...selection,
      status: "awaiting_invite",
      invite: normalizedInvite,
      inviteMessageId,
      inviteFallbackAt: new Date(Date.now() + fallbackDelayMs).toISOString(),
      announcement: null,
      preparedComments: comments.slice(0, 3).map((comment) => `${comment || ""}`.trim()).filter(Boolean),
      preparedAnnouncement: `${announcement || ""}`.trim(),
      countdownEndsAt: null
    };
    appendSceneZeroAction("participant-invite-typing");
    emitSceneZero("scene-zero-participant-awaiting-invite");

    scheduleSceneZeroParticipantAction(() => {
      beginSceneZeroParticipantCountdown(sequence);
    }, fallbackDelayMs);

    return { applied: true, state: publicSceneZeroSnapshot(state.sceneZero) };
  }

  function beginSceneZeroCollectionCountdown(messageId) {
    const countdown = state.sceneZero.collection.activeCountdown;
    if (countdown?.status !== "awaiting_message" || countdown.messageId !== messageId) return false;

    clearSceneZeroCollectionTimers();
    const durationSeconds = Math.max(3, Math.min(60, Number(countdown.durationSeconds) || 0));
    const startedAt = new Date();
    const sequence = countdown.sequence;
    state.sceneZero.collection.activeCountdown = {
      ...countdown,
      status: "running",
      startedAt: startedAt.toISOString(),
      endsAt: new Date(startedAt.getTime() + durationSeconds * 1000).toISOString(),
      completedAt: null,
      fallbackAt: null
    };
    appendSceneZeroAction("collection-countdown-start", `${durationSeconds}s`);
    emitSceneZero("scene-zero-collection-countdown");

    scheduleSceneZeroCollectionAction(() => {
      const active = state.sceneZero.collection.activeCountdown;
      if (active.sequence !== sequence || active.status !== "running") return;
      state.sceneZero.collection.activeCountdown = {
        ...active,
        status: "complete",
        endsAt: null,
        completedAt: new Date().toISOString()
      };
      appendSceneZeroAction("collection-countdown-complete", `${durationSeconds}s`);
      emitSceneZero("scene-zero-collection-countdown-complete");
    }, durationSeconds * 1000);

    return true;
  }

  function completeSceneZeroMessageTyping(messageId) {
    const safeId = `${messageId || ""}`;
    if (!safeId) return { applied: false, reason: "message_id_missing" };

    const selection = state.sceneZero.participantSelection;
    if (selection?.status === "awaiting_invite" && selection.inviteMessageId === safeId) {
      return { applied: beginSceneZeroParticipantCountdown(selection.sequence), target: "participant" };
    }

    if (beginSceneZeroCollectionCountdown(safeId)) {
      return { applied: true, target: "collection" };
    }

    return { applied: false, reason: "message_not_waiting" };
  }

  function scheduleSceneZeroTimer() {
    clearSceneZeroTimer();
    const endsAt = Date.parse(state.sceneZero.timer.endsAt || "");
    const delay = endsAt - Date.now();

    if (!Number.isFinite(delay) || delay <= 0) {
      state.sceneZero.timer = {
        ...state.sceneZero.timer,
        status: "complete",
        remainingSeconds: 0,
        endsAt: null,
        completedAt: new Date().toISOString()
      };
      emitSceneZero("scene-zero-timer-complete");
      return;
    }

    const sequence = state.sceneZero.timer.sequence;
    sceneZeroTimer = setTimeout(() => {
      sceneZeroTimer = null;
      if (state.sceneZero.timer.sequence !== sequence || state.sceneZero.timer.status !== "running") {
        return;
      }

      state.sceneZero.timer = {
        ...state.sceneZero.timer,
        status: "complete",
        remainingSeconds: 0,
        endsAt: null,
        completedAt: new Date().toISOString()
      };
      appendSceneZeroAction("timer_complete");
      emitSceneZero("scene-zero-timer-complete");
    }, delay);
  }

  function scheduleSceneZeroGincanaTimer() {
    clearSceneZeroGincanaTimer();
    const suitcaseGame = ensureSceneZeroSuitcaseGame();
    const timer = suitcaseGame.gincana.timer;
    if (timer.status !== "running" || !timer.endsAt) return;

    const delay = Math.max(0, Date.parse(timer.endsAt) - Date.now());
    if (delay === 0) {
      suitcaseGame.gincana.timer = {
        ...timer,
        status: "complete",
        remainingSeconds: 0,
        endsAt: null,
        completedAt: new Date().toISOString()
      };
      emitSceneZero("scene-zero-gincana-timer-complete");
      return;
    }

    const sequence = timer.sequence;
    sceneZeroGincanaTimer = setTimeout(() => {
      sceneZeroGincanaTimer = null;
      const current = ensureSceneZeroSuitcaseGame().gincana.timer;
      if (current.sequence !== sequence || current.status !== "running") return;
      state.sceneZero.suitcaseGame.gincana.timer = {
        ...current,
        status: "complete",
        remainingSeconds: 0,
        endsAt: null,
        completedAt: new Date().toISOString()
      };
      appendSceneZeroAction("gincana_timer_complete");
      emitSceneZero("scene-zero-gincana-timer-complete");
    }, delay);
  }

  function controlSceneZero(action, payload = {}, { source = "operator" } = {}) {
    const now = new Date();
    const nowIso = now.toISOString();
    const detail = `${payload.detail || ""}`.trim();
    const suitcaseGame = ensureSceneZeroSuitcaseGame();

    if (action === "set-stage") {
      const stage = normalizeSceneZeroStage(payload.stage);
      if (!stage) {
        return { applied: false, error: "SCENE ZERO STAGE UNKNOWN", state: publicSceneZeroSnapshot(state.sceneZero) };
      }

      if (stage !== state.sceneZero.stage) {
        if (stage !== "participant" && ["preparing", "awaiting_invite", "countdown", "roulette", "selected"].includes(state.sceneZero.participantSelection?.status)) {
          clearSceneZeroParticipantTimers();
          state.sceneZero.participantSelection = {
            ...state.sceneZero.participantSelection,
            status: "cancelled",
            countdownEndsAt: null,
            rouletteEndsAt: null
          };
        }
        state.sceneZero.previousStage = state.sceneZero.stage;
        state.sceneZero.stage = stage;
        state.sceneZero.stageStartedAt = nowIso;
        if (stage !== "collection" && ["awaiting_message", "running"].includes(state.sceneZero.collection?.activeCountdown?.status)) {
          clearSceneZeroCollectionTimers();
          state.sceneZero.collection.activeCountdown = {
            ...state.sceneZero.collection.activeCountdown,
            status: "cancelled",
            endsAt: null
          };
        }
      }
      state.sceneZero.airportActive = stage === "airport";
      if (stage === "instagram") state.sceneZero.instagramActive = true;
      appendSceneZeroAction(`enter_${stage}`, detail);
    } else if (action === "set-personality-guidance") {
      const currentGuidance = state.sceneZero.personalityGuidance || {};
      const text = Object.hasOwn(payload, "guidance")
        ? `${payload.guidance || ""}`.trim().replace(/\s+/g, " ").slice(0, 2000)
        : `${currentGuidance.text || ""}`;
      const quickDirections = Object.hasOwn(payload, "quickDirections")
        ? normalizeSceneZeroPersonalityDirections(payload.quickDirections)
        : normalizeSceneZeroPersonalityDirections(currentGuidance.quickDirections);
      state.sceneZero.personalityGuidance = {
        text,
        quickDirections,
        updatedAt: nowIso
      };
      appendSceneZeroAction(text || quickDirections.length ? "personality_guidance_updated" : "personality_guidance_cleared");
    } else if (action === "participant-volunteers") {
      state.sceneZero.participantSelectionArmed = true;
      appendSceneZeroAction(action, detail);
    } else if (action === "choose-participant" || action === "choose-another-participant") {
      const participant = selectSceneZeroParticipant({ chooseAnother: action === "choose-another-participant" });
      if (!participant) {
        return { applied: false, error: "SCENE ZERO PARTICIPANT POOL EMPTY", state: publicSceneZeroSnapshot(state.sceneZero) };
      }
      appendSceneZeroAction(action, participant.name);
    } else if (action === "record-output") {
      const text = `${payload.text || ""}`.trim();
      if (payload.kind === "collection-question" && text) {
        clearSceneZeroCollectionTimers();
        const collectionData = payload.collectionData && typeof payload.collectionData === "object"
          ? payload.collectionData
          : {};
        const messageId = `${payload.messageId || ""}` || null;
        const waitSeconds = Number(collectionData.waitSeconds) >= 3
          ? Math.min(60, Math.round(Number(collectionData.waitSeconds)))
          : null;
        const question = {
          id: randomUUID(),
          text,
          requestedAction: collectionData.action || detail || null,
          topic: collectionData.topic || null,
          action: collectionData.action || null,
          expectedAnswerType: collectionData.expectedAnswerType || null,
          result: null,
          estimatedCount: null,
          intensity: Number(collectionData.intensity) || 0,
          sensitivity: collectionData.sensitivity || "low",
          locationContext: collectionData.locationContext || null,
          scope: collectionData.scope || "room",
          conditions: Array.isArray(collectionData.conditions) ? collectionData.conditions.slice(0, 5) : [],
          waitSeconds,
          messageId,
          timestamp: nowIso
        };
        const previousQuestions = payload.replaceLast
          ? state.sceneZero.collection.questions.slice(0, -1)
          : state.sceneZero.collection.questions;
        state.sceneZero.collection.questions = [...previousQuestions, question].slice(-30);
        state.sceneZero.collection.lastQuestion = text;
        state.sceneZero.collection.lastRequestedAction = question.action || detail || null;
        if (!payload.replaceLast) {
          state.sceneZero.collection.instructionCount = (state.sceneZero.collection.instructionCount || 0) + 1;
        }
        state.sceneZero.collection.activeCountdown = waitSeconds && messageId
          ? {
            status: "awaiting_message",
            messageId,
            durationSeconds: waitSeconds,
            startedAt: null,
            endsAt: null,
            completedAt: null,
            fallbackAt: new Date(now.getTime() + Math.max(20000, (text.length * 42) + 8000)).toISOString(),
            sequence: (state.sceneZero.collection.activeCountdown?.sequence || 0) + 1
          }
          : {
            status: "idle",
            messageId,
            durationSeconds: null,
            startedAt: null,
            endsAt: null,
          completedAt: null,
          fallbackAt: null,
          sequence: (state.sceneZero.collection.activeCountdown?.sequence || 0) + 1
          };
        if (waitSeconds && messageId) {
          const sequence = state.sceneZero.collection.activeCountdown.sequence;
          const fallbackDelayMs = Math.max(20000, (text.length * 42) + 8000);
          scheduleSceneZeroCollectionAction(() => {
            const active = state.sceneZero.collection.activeCountdown;
            if (active.sequence !== sequence || active.status !== "awaiting_message") return;
            beginSceneZeroCollectionCountdown(messageId);
          }, fallbackDelayMs);
        }
      }
      if (payload.kind === "collection-comment" && text) {
        state.sceneZero.collection.lastComment = text;
      }
    } else if (action === "collection-record-result") {
      const questions = state.sceneZero.collection.questions || [];
      const lastQuestion = questions.at(-1);
      if (!lastQuestion) {
        return { applied: false, error: "SCENE ZERO COLLECTION QUESTION MISSING", state: publicSceneZeroSnapshot(state.sceneZero) };
      }
      const allowedResults = new Set(["none", "few", "half", "many", "almost_all", "all", "count", "qualitative"]);
      const requestedResult = `${payload.result || "qualitative"}`.trim();
      const result = requestedResult === "qualitative" && lastQuestion.result
        ? lastQuestion.result
        : allowedResults.has(requestedResult) ? requestedResult : "qualitative";
      const resultLabel = {
        none: "ninguém",
        few: "poucos",
        half: "metade",
        many: "muitos",
        almost_all: "quase todos",
        all: "todos",
        count: "contagem informada",
        qualitative: "observação qualitativa"
      }[result];
      const estimatedCount = payload.estimatedCount === null || payload.estimatedCount === undefined || payload.estimatedCount === ""
        ? lastQuestion.estimatedCount || null
        : `${payload.estimatedCount}`.trim().slice(0, 20);
      const observationText = `${payload.observation || detail || ""}`.trim().replace(/\s+/g, " ").slice(0, 300);
      const updated = {
        ...lastQuestion,
        result,
        resultLabel,
        estimatedCount,
        observation: observationText || null,
        answeredAt: nowIso
      };
      state.sceneZero.collection.questions = [...questions.slice(0, -1), updated];
      if (observationText) {
        state.sceneZero.collection.observations = [...(state.sceneZero.collection.observations || []), {
          id: randomUUID(),
          text: observationText,
          questionId: updated.id,
          timestamp: nowIso
        }].slice(-30);
      }
      const segment = {
        id: randomUUID(),
        questionId: updated.id,
        topic: updated.topic,
        conditions: updated.conditions,
        result,
        resultLabel,
        estimatedCount,
        description: observationText || `${result} respondeu à intervenção sobre ${updated.topic || "tema não classificado"}`,
        timestamp: nowIso
      };
      const priorSegments = (state.sceneZero.collection.segments || []).filter((item) => item.questionId !== updated.id);
      state.sceneZero.collection.segments = [...priorSegments, segment].slice(-20);
      state.sceneZero.collection.obedience = collectionObedienceFromQuestions(state.sceneZero.collection.questions);
      clearSceneZeroCollectionTimers();
      state.sceneZero.collection.activeCountdown = {
        ...state.sceneZero.collection.activeCountdown,
        status: "idle",
        endsAt: null,
        completedAt: null,
        fallbackAt: null,
        sequence: (state.sceneZero.collection.activeCountdown?.sequence || 0) + 1
      };
      appendSceneZeroAction(action, [result, estimatedCount, observationText].filter(Boolean).join(" / "));
    } else if (action === "collection-local-context-loading") {
      state.sceneZero.collection.localContext = {
        ...state.sceneZero.collection.localContext,
        status: "loading",
        error: null
      };
      appendSceneZeroAction(action);
    } else if (action === "collection-local-context-ready") {
      state.sceneZero.collection.localContext = {
        status: "ready",
        summary: `${payload.summary || ""}`.slice(0, 1600),
        facts: Array.isArray(payload.facts) ? payload.facts.slice(0, 6) : [],
        sources: Array.isArray(payload.sources) ? payload.sources.slice(0, 6) : [],
        updatedAt: payload.updatedAt || nowIso,
        error: null
      };
      appendSceneZeroAction(action);
    } else if (action === "collection-local-context-error") {
      state.sceneZero.collection.localContext = {
        ...state.sceneZero.collection.localContext,
        status: "error",
        error: `${payload.error || "falha ao atualizar"}`.slice(0, 180)
      };
      appendSceneZeroAction(action);
    } else if (["collection-new-question", "collection-rephrase", "collection-comment"].includes(action)) {
      clearSceneZeroCollectionTimers();
      state.sceneZero.collection.activeCountdown = {
        ...state.sceneZero.collection.activeCountdown,
        status: "idle",
        endsAt: null,
        completedAt: null,
        fallbackAt: null,
        sequence: (state.sceneZero.collection.activeCountdown?.sequence || 0) + 1
      };
      appendSceneZeroAction(action, detail);
    } else if (action === "collection-end") {
      clearSceneZeroCollectionTimers();
      state.sceneZero.collection.activeCountdown = {
        ...state.sceneZero.collection.activeCountdown,
        status: "cancelled",
        endsAt: null,
        fallbackAt: null,
        sequence: (state.sceneZero.collection.activeCountdown?.sequence || 0) + 1
      };
      state.sceneZero.collection.endedAt = nowIso;
      appendSceneZeroAction(action, detail);
    } else if (action === "suitcase-select") {
      const suitcaseNumber = Number(payload.suitcase);
      const suitcase = SCENE_ZERO_SUITCASES[suitcaseNumber];
      if (!suitcase) {
        return { applied: false, error: "SCENE ZERO SUITCASE UNKNOWN", state: publicSceneZeroSnapshot(state.sceneZero) };
      }
      if (suitcaseGame.currentSuitcase !== suitcaseNumber) {
        suitcaseGame.previousSuitcase = suitcaseGame.currentSuitcase;
      }
      suitcaseGame.currentSuitcase = suitcaseNumber;
      suitcaseGame.currentGame = suitcase.game;
      suitcaseGame.startedAt = nowIso;
      appendSceneZeroAction(action, `${suitcaseNumber} / ${suitcase.label}`);
    } else if (action === "gincana-draw") {
      const task = publicGincanaTask(payload.task);
      const durationSeconds = Math.max(60, Math.min(120, Math.round(Number(payload.durationSeconds) || 60)));
      if (!task) {
        return { applied: false, error: "SCENE ZERO GINCANA MISSING", state: publicSceneZeroSnapshot(state.sceneZero) };
      }
      clearSceneZeroGincanaTimer();
      suitcaseGame.gincana = {
        ...suitcaseGame.gincana,
        currentTask: task,
        usedTaskIds: [...new Set([...(suitcaseGame.gincana.usedTaskIds || []), task.id])],
        durationSeconds,
        instruction: task.instruction,
        result: null,
        observation: null,
        elapsedSeconds: null,
        lastComment: null,
        timer: {
          status: "idle",
          durationSeconds,
          remainingSeconds: durationSeconds,
          startedAt: null,
          endsAt: null,
          pausedAt: null,
          completedAt: null,
          sequence: (suitcaseGame.gincana.timer?.sequence || 0) + 1
        }
      };
      appendSceneZeroAction(action, `${task.id} / ${durationSeconds}s`);
    } else if (action === "gincana-timer-start" || action === "gincana-timer-restart") {
      const durationSeconds = suitcaseGame.gincana.durationSeconds;
      if (!suitcaseGame.gincana.currentTask || !durationSeconds) {
        return { applied: false, error: "SCENE ZERO GINCANA NOT DRAWN", state: publicSceneZeroSnapshot(state.sceneZero) };
      }
      clearSceneZeroGincanaTimer();
      suitcaseGame.gincana.timer = {
        ...suitcaseGame.gincana.timer,
        status: "running",
        durationSeconds,
        remainingSeconds: durationSeconds,
        startedAt: nowIso,
        endsAt: new Date(now.getTime() + durationSeconds * 1000).toISOString(),
        pausedAt: null,
        completedAt: null,
        sequence: (suitcaseGame.gincana.timer?.sequence || 0) + 1
      };
      suitcaseGame.gincana.result = null;
      suitcaseGame.gincana.observation = null;
      suitcaseGame.gincana.elapsedSeconds = null;
      appendSceneZeroAction(action, `${durationSeconds}s`);
      scheduleSceneZeroGincanaTimer();
    } else if (action === "gincana-timer-pause" && suitcaseGame.gincana.timer.status === "running") {
      const remainingMs = Math.max(0, Date.parse(suitcaseGame.gincana.timer.endsAt) - now.getTime());
      clearSceneZeroGincanaTimer();
      suitcaseGame.gincana.timer = {
        ...suitcaseGame.gincana.timer,
        status: remainingMs === 0 ? "complete" : "paused",
        remainingSeconds: Math.ceil(remainingMs / 1000),
        endsAt: null,
        pausedAt: nowIso,
        completedAt: remainingMs === 0 ? nowIso : null
      };
      appendSceneZeroAction(action);
    } else if (action === "gincana-timer-resume" && suitcaseGame.gincana.timer.status === "paused") {
      const remainingSeconds = Math.max(0, suitcaseGame.gincana.timer.remainingSeconds || 0);
      suitcaseGame.gincana.timer = {
        ...suitcaseGame.gincana.timer,
        status: remainingSeconds ? "running" : "complete",
        endsAt: remainingSeconds ? new Date(now.getTime() + remainingSeconds * 1000).toISOString() : null,
        pausedAt: null,
        completedAt: remainingSeconds ? null : nowIso,
        sequence: suitcaseGame.gincana.timer.sequence + 1
      };
      appendSceneZeroAction(action);
      if (remainingSeconds) scheduleSceneZeroGincanaTimer();
    } else if (action === "gincana-timer-cancel") {
      clearSceneZeroGincanaTimer();
      suitcaseGame.gincana.timer = {
        ...suitcaseGame.gincana.timer,
        status: "cancelled",
        remainingSeconds: suitcaseGame.gincana.durationSeconds,
        endsAt: null,
        pausedAt: null,
        completedAt: null,
        sequence: suitcaseGame.gincana.timer.sequence + 1
      };
      appendSceneZeroAction(action);
    } else if (action === "gincana-finish") {
      if (!suitcaseGame.gincana.currentTask) {
        return { applied: false, error: "SCENE ZERO GINCANA NOT DRAWN", state: publicSceneZeroSnapshot(state.sceneZero) };
      }
      const timer = suitcaseGame.gincana.timer;
      const liveRemaining = timer.status === "running" && timer.endsAt
        ? Math.max(0, Math.ceil((Date.parse(timer.endsAt) - now.getTime()) / 1000))
        : Math.max(0, Number(timer.remainingSeconds) || 0);
      const elapsedSeconds = Math.max(0, (timer.durationSeconds || suitcaseGame.gincana.durationSeconds || 0) - liveRemaining);
      const outcome = payload.outcome === "completed" ? "completed" : "failed";
      clearSceneZeroGincanaTimer();
      suitcaseGame.gincana.result = outcome;
      suitcaseGame.gincana.observation = detail || null;
      suitcaseGame.gincana.elapsedSeconds = elapsedSeconds;
      suitcaseGame.gincana.timer = {
        ...timer,
        status: outcome,
        remainingSeconds: liveRemaining,
        endsAt: null,
        completedAt: nowIso,
        sequence: timer.sequence + 1
      };
      appendSceneZeroAction(action, `${outcome} / ${elapsedSeconds}s / ${detail}`);
    } else if (action === "suitcase-comment") {
      const text = `${payload.text || ""}`.trim().slice(0, 2000);
      suitcaseGame.lastComment = text || suitcaseGame.lastComment;
      if (payload.kind === "gincana") suitcaseGame.gincana.lastComment = text || suitcaseGame.gincana.lastComment;
      appendSceneZeroAction(action, payload.kind || "");
    } else if (action === "instagram-session-start") {
      const profile = payload.profile && typeof payload.profile === "object" ? {
        id: `${payload.profile.id || ""}`.slice(0, 40),
        label: `${payload.profile.label || ""}`.slice(0, 80),
        username: `${payload.profile.username || ""}`.replace(/^@/, "").slice(0, 30)
      } : null;
      if (!profile?.id || !profile.username) {
        return { applied: false, error: "SCENE ZERO INSTAGRAM PROFILE INVALID", state: publicSceneZeroSnapshot(state.sceneZero) };
      }
      suitcaseGame.instagram = {
        ...suitcaseGame.instagram,
        previousProfile: suitcaseGame.instagram.currentProfile,
        currentProfile: profile,
        currentPostIndex: 1,
        currentPost: null,
        pendingComment: null,
        status: "loading",
        paused: false,
        lastError: null
      };
      state.sceneZero.instagramActive = true;
      appendSceneZeroAction(action, `${profile.label} / @${profile.username}`);
    } else if (action === "instagram-post-loading") {
      suitcaseGame.instagram.currentPostIndex = Math.max(1, Math.min(10, Math.round(Number(payload.index) || 1)));
      suitcaseGame.instagram.status = "loading";
      suitcaseGame.instagram.pendingComment = null;
      suitcaseGame.instagram.lastError = null;
      appendSceneZeroAction(action, `${suitcaseGame.instagram.currentPostIndex}`);
    } else if (action === "instagram-post-preview") {
      const post = payload.post && typeof payload.post === "object" ? {
        key: `${payload.post.key || ""}`.slice(0, 500),
        url: `${payload.post.url || ""}`.slice(0, 500),
        index: Math.max(1, Math.min(10, Math.round(Number(payload.post.index) || 1))),
        digest: `${payload.post.digest || ""}`.slice(0, 4000),
        visualAnalysis: `${payload.post.visualAnalysis || ""}`.slice(0, 1600)
      } : null;
      const comment = `${payload.comment || ""}`.trim().replace(/\s+/g, " ").slice(0, 220);
      if (!post?.key || !comment) {
        return { applied: false, error: "SCENE ZERO INSTAGRAM PREVIEW INVALID", state: publicSceneZeroSnapshot(state.sceneZero) };
      }
      suitcaseGame.instagram.currentPostIndex = post.index;
      suitcaseGame.instagram.currentPost = post;
      suitcaseGame.instagram.pendingComment = comment;
      suitcaseGame.instagram.status = "preview";
      suitcaseGame.instagram.processedPostKeys = [...new Set([...(suitcaseGame.instagram.processedPostKeys || []), post.key])];
      appendSceneZeroAction(action, post.key);
    } else if (action === "instagram-comment-sent") {
      const postKey = `${payload.postKey || ""}`;
      if (!postKey || postKey !== suitcaseGame.instagram.currentPost?.key || !suitcaseGame.instagram.pendingComment) {
        return { applied: false, error: "SCENE ZERO INSTAGRAM COMMENT STATE MISMATCH", state: publicSceneZeroSnapshot(state.sceneZero) };
      }
      if (suitcaseGame.instagram.commentedPostKeys.includes(postKey)) {
        return { applied: false, error: "SCENE ZERO INSTAGRAM COMMENT DUPLICATE", state: publicSceneZeroSnapshot(state.sceneZero) };
      }
      const entry = {
        profile: suitcaseGame.instagram.currentProfile?.label || "",
        username: suitcaseGame.instagram.currentProfile?.username || "",
        postKey,
        postIndex: suitcaseGame.instagram.currentPostIndex,
        comment: suitcaseGame.instagram.pendingComment,
        status: `${payload.status || "commented"}`.slice(0, 80),
        timestamp: nowIso
      };
      suitcaseGame.instagram.commentedPostKeys = [...suitcaseGame.instagram.commentedPostKeys, postKey];
      suitcaseGame.instagram.recentComments = [...suitcaseGame.instagram.recentComments, entry].slice(-20);
      suitcaseGame.instagram.status = "sent";
      suitcaseGame.instagram.pendingComment = null;
      suitcaseGame.lastComment = entry.comment;
      appendSceneZeroAction(action, postKey);
    } else if (action === "instagram-session-pause") {
      suitcaseGame.instagram.paused = true;
      suitcaseGame.instagram.status = "paused";
      appendSceneZeroAction(action);
    } else if (action === "instagram-session-stop") {
      suitcaseGame.instagram.paused = false;
      suitcaseGame.instagram.status = "stopped";
      suitcaseGame.instagram.pendingComment = null;
      state.sceneZero.instagramActive = false;
      appendSceneZeroAction(action);
    } else if (action === "instagram-session-error") {
      suitcaseGame.instagram.status = "error";
      suitcaseGame.instagram.lastError = `${payload.error || "falha no Instagram"}`.slice(0, 300);
      appendSceneZeroAction(action, suitcaseGame.instagram.lastError);
    } else if (action === "timer-start" || action === "timer-restart") {
      clearSceneZeroTimer();
      state.sceneZero.timer = {
        ...state.sceneZero.timer,
        status: "running",
        remainingSeconds: 15,
        startedAt: nowIso,
        endsAt: new Date(now.getTime() + 15000).toISOString(),
        pausedAt: null,
        completedAt: null,
        sequence: state.sceneZero.timer.sequence + 1
      };
      appendSceneZeroAction(action);
      scheduleSceneZeroTimer();
    } else if (action === "timer-pause" && state.sceneZero.timer.status === "running") {
      const remainingMs = Math.max(0, Date.parse(state.sceneZero.timer.endsAt) - now.getTime());
      clearSceneZeroTimer();
      state.sceneZero.timer = {
        ...state.sceneZero.timer,
        status: "paused",
        remainingSeconds: Math.ceil(remainingMs / 1000),
        endsAt: null,
        pausedAt: nowIso
      };
      appendSceneZeroAction(action);
    } else if (action === "timer-resume" && state.sceneZero.timer.status === "paused") {
      const remainingSeconds = Math.max(0, state.sceneZero.timer.remainingSeconds);
      state.sceneZero.timer = {
        ...state.sceneZero.timer,
        status: remainingSeconds === 0 ? "complete" : "running",
        endsAt: remainingSeconds === 0 ? null : new Date(now.getTime() + remainingSeconds * 1000).toISOString(),
        pausedAt: null,
        sequence: state.sceneZero.timer.sequence + 1
      };
      appendSceneZeroAction(action);
      if (remainingSeconds > 0) scheduleSceneZeroTimer();
    } else if (action === "timer-cancel") {
      clearSceneZeroTimer();
      state.sceneZero.timer = {
        ...state.sceneZero.timer,
        status: "cancelled",
        remainingSeconds: 15,
        endsAt: null,
        pausedAt: null,
        completedAt: null,
        sequence: state.sceneZero.timer.sequence + 1
      };
      appendSceneZeroAction(action);
    } else if (action === "set-glitch") {
      const level = normalizeSceneZeroGlitchLevel(payload.level);
      if (!level) {
        return { applied: false, error: "SCENE ZERO GLITCH LEVEL UNKNOWN", state: publicSceneZeroSnapshot(state.sceneZero) };
      }
      state.sceneZero.glitchLevel = level;
      appendSceneZeroAction(action, level);
    } else if (action === "step-glitch") {
      const currentIndex = sceneZeroGlitchIndex(state.sceneZero.glitchLevel);
      const nextIndex = Math.max(0, Math.min(5, currentIndex + (Number(payload.delta) < 0 ? -1 : 1)));
      state.sceneZero.glitchLevel = ["normal", "glitch-1", "glitch-2", "glitch-3", "glitch-4", "collapse"][nextIndex];
      appendSceneZeroAction(action, state.sceneZero.glitchLevel);
    } else if (action === "instagram-start" || action === "instagram-stop") {
      state.sceneZero.instagramActive = action === "instagram-start";
      appendSceneZeroAction(action, detail);
    } else if (["tea-play", "tea-restart", "tea-stop"].includes(action)) {
      state.sceneZero.teaForTwo = {
        status: action === "tea-stop" ? "stopped" : "playing",
        sequence: state.sceneZero.teaForTwo.sequence + 1,
        startedAt: action === "tea-stop" ? null : nowIso
      };
      appendSceneZeroAction(action);
    } else if (action !== "record-output") {
      appendSceneZeroAction(action, detail);
    }

    emitSceneZero();
    return { applied: true, source, state: publicSceneZeroSnapshot(state.sceneZero) };
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
        audio: glitchAudioForPreset(nextPreset, payload.audio),
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
        audio: glitchAudioForPreset(preset, payload.audio),
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

  function controlRobotSound(patch = {}) {
    const now = new Date().toISOString();
    const outputResetSequence = patch.reconnectOutput
      ? (state.robotSound.outputResetSequence || 0) + 1
      : state.robotSound.outputResetSequence || 0;
    state.robotSound = normalizeRobotSoundSettings({
      ...state.robotSound,
      ...patch,
      outputResetSequence,
      sequence: (state.robotSound.sequence || 0) + 1,
      updatedAt: now
    }, state.robotSound);
    emit({ type: "robot-sound", robotSound: publicRobotSoundSnapshot(state.robotSound) });
    return publicRobotSoundSnapshot(state.robotSound);
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

    const normalizedCue = normalizeSceneCue(cue);
    const sequence = (state.sceneCue.sequence || 0) + 1;
    const triggeredAt = new Date().toISOString();
    const clearAt = normalizedCue.durationMs > 0
      ? new Date(Date.now() + normalizedCue.durationMs).toISOString()
      : null;

    if (normalizedCue.type === "audio") {
      const currentAudioCues = Array.isArray(state.sceneCue.audioCues) ? state.sceneCue.audioCues : [];
      const withoutExistingLoop = normalizedCue.loop
        ? currentAudioCues.filter((item) => !(item.controllerId === normalizedControllerId && item.id === normalizedCue.id && item.loop))
        : currentAudioCues;
      const audioCue = {
        ...normalizedCue,
        controllerId: normalizedControllerId,
        triggeredAt,
        sequence
      };

      state.sceneCue = {
        ...state.sceneCue,
        audioCues: [...withoutExistingLoop, audioCue].slice(-64),
        sequence
      };
      emitSceneCue();

      logPerformance({
        type: "SCENE_CUE",
        source,
        public: true,
        controllerId: normalizedControllerId,
        cueId: normalizedCue.id,
        playbackId: normalizedCue.playbackId,
        action: "play"
      });

      return {
        applied: true,
        playbackId: normalizedCue.playbackId,
        state: publicSceneCueSnapshot(state.sceneCue)
      };
    }

    clearSceneCueTimers();
    state.sceneCue = {
      controllerId: normalizedControllerId,
      cue: normalizedCue,
      audioCues: Array.isArray(state.sceneCue.audioCues) ? state.sceneCue.audioCues : [],
      triggeredAt,
      clearAt,
      sequence
    };
    emitSceneCue();

    if (normalizedCue.durationMs > 0) {
      const timer = setTimeout(() => {
        sceneCueTimers.delete(timer);

        if (state.sceneCue.cue?.playbackId !== normalizedCue.playbackId) {
          return;
        }

        state.sceneCue = {
          ...createInitialSceneCueState(),
          audioCues: Array.isArray(state.sceneCue.audioCues) ? state.sceneCue.audioCues : [],
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

  function stopSceneCue({ controllerId, cueId, playbackId, source = "controller" } = {}) {
    const normalizedControllerId = `${controllerId || ""}`.trim();
    const audioCues = Array.isArray(state.sceneCue.audioCues) ? state.sceneCue.audioCues : [];
    const nextAudioCues = audioCues.filter((item) => {
      if (item.controllerId !== normalizedControllerId) {
        return true;
      }
      if (playbackId) {
        return item.playbackId !== playbackId;
      }
      return cueId ? item.id !== cueId : false;
    });
    const stoppedAudio = nextAudioCues.length !== audioCues.length;
    const activeCue = state.sceneCue.cue;
    const matchesActiveCue = activeCue
      && state.sceneCue.controllerId === normalizedControllerId
      && (!cueId || activeCue.id === cueId);

    if (!matchesActiveCue && !stoppedAudio) {
      return { applied: true, stopped: false, state: publicSceneCueSnapshot(state.sceneCue) };
    }

    state.sceneCue = {
      ...state.sceneCue,
      ...(matchesActiveCue ? {
        controllerId: null,
        cue: null,
        triggeredAt: null,
        clearAt: null
      } : {}),
      audioCues: nextAudioCues
    };
    emitSceneCue("scene-cue-stop");

    logPerformance({
      type: "SCENE_CUE",
      source,
      public: true,
      controllerId: normalizedControllerId,
      cueId: cueId || activeCue?.id || null,
      playbackId: playbackId || null,
      action: "stop"
    });

    return { applied: true, stopped: true, state: publicSceneCueSnapshot(state.sceneCue) };
  }

  function updateSceneAudioCue({ controllerId, cueId, patch = {}, source = "controller" } = {}) {
    const normalizedControllerId = `${controllerId || ""}`.trim();
    let updated = false;
    const fadePlaybackIds = [];
    const audioCues = (Array.isArray(state.sceneCue.audioCues) ? state.sceneCue.audioCues : []).map((item) => {
      if (item.controllerId !== normalizedControllerId || item.id !== `${cueId || ""}`.trim()) {
        return item;
      }

      updated = true;
      if (patch.fadeOutMs !== undefined) fadePlaybackIds.push(item.playbackId);
      return {
        ...item,
        ...(patch.loop === undefined ? {} : { loop: Boolean(patch.loop) }),
        ...(patch.volume === undefined ? {} : {
          volume: Math.max(0, Math.min(1, Number.isFinite(Number(patch.volume)) ? Number(patch.volume) : item.volume))
        }),
        ...(patch.audioEffects === undefined ? {} : {
          audioEffects: normalizeSceneAudioEffects(patch.audioEffects, item.audioEffects)
        }),
        ...(patch.fadeOutMs === undefined ? {} : {
          fadeOutMs: Math.max(100, Math.min(10000, Number(patch.fadeOutMs) || 2000)),
          fadeOutSequence: Number(item.fadeOutSequence || 0) + 1
        })
      };
    });

    if (updated) {
      state.sceneCue = { ...state.sceneCue, audioCues };
      emitSceneCue("scene-cue-update");
      logPerformance({
        type: "SCENE_CUE",
        source,
        public: true,
        controllerId: normalizedControllerId,
        cueId,
        action: "update"
      });

      if (fadePlaybackIds.length > 0) {
        const fadeDuration = Math.max(100, Math.min(10000, Number(patch.fadeOutMs) || 2000));
        const fading = new Set(fadePlaybackIds);
        setTimeout(() => {
          const currentAudioCues = Array.isArray(state.sceneCue.audioCues) ? state.sceneCue.audioCues : [];
          const remaining = currentAudioCues.filter((item) => !fading.has(item.playbackId));
          if (remaining.length === currentAudioCues.length) return;
          state.sceneCue = { ...state.sceneCue, audioCues: remaining };
          emitSceneCue("scene-cue-fade-complete");
        }, fadeDuration);
      }
    }

    return { applied: true, updated, state: publicSceneCueSnapshot(state.sceneCue) };
  }

  function controlForcaGShaders(action, payload = {}, { source = "controller" } = {}) {
    const normalizedAction = `${action || ""}`.toLowerCase();
    const current = state.forcaGShaders;
    let next = { ...current };

    if (["tunnel", "redout", "distortion"].includes(normalizedAction)) {
      next[normalizedAction] = payload.enabled === undefined ? !current[normalizedAction] : Boolean(payload.enabled);
    } else if (normalizedAction === "intensity") {
      next.intensity = Math.max(0, Math.min(100, Number(payload.intensity) || 0));
    } else if (normalizedAction === "clear") {
      next = {
        ...createInitialForcaGShaderState(),
        intensity: current.intensity
      };
    } else {
      return { applied: false, error: "FORCA G SHADER ACTION UNKNOWN", state: publicForcaGShaderSnapshot(current) };
    }

    state.forcaGShaders = {
      ...next,
      updatedAt: new Date().toISOString(),
      sequence: (current.sequence || 0) + 1
    };

    logPerformance({
      type: "FORCA_G_SHADER",
      source,
      public: true,
      action: normalizedAction,
      state: publicForcaGShaderSnapshot(state.forcaGShaders)
    });
    emit({ type: "forca-g-shaders", forcaGShaders: publicForcaGShaderSnapshot(state.forcaGShaders) });

    return { applied: true, state: publicForcaGShaderSnapshot(state.forcaGShaders) };
  }

  function controlForcaGSampler(action, payload = {}, { source = "controller" } = {}) {
    const result = reduceForcaGSamplerState(state.forcaGSampler, action, payload);
    if (!result.applied) {
      return { ...result, state: publicForcaGSamplerSnapshot(state.forcaGSampler) };
    }

    state.forcaGSampler = result.state;
    logPerformance({
      type: "FORCA_G_SAMPLER",
      source,
      public: true,
      action: `${action || ""}`.toLowerCase(),
      itemId: payload.item?.id || payload.itemId || null,
      category: payload.item?.category || payload.category || null
    });
    emit({ type: "forca-g-sampler", forcaGSampler: publicForcaGSamplerSnapshot(state.forcaGSampler) });
    return { applied: true, state: publicForcaGSamplerSnapshot(state.forcaGSampler) };
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

  function syncBaralhoMorbidoCards(cards, { source = "assets" } = {}) {
    const previousCurrentCardId = state.baralhoMorbido.currentCard?.id || null;
    const result = syncBaralhoMorbidoCardsState(state.baralhoMorbido, cards);
    state.baralhoMorbido = result.state;

    if (result.changed) {
      if (previousCurrentCardId && !state.baralhoMorbido.currentCard) {
        clearBaralhoMorbidoTimers();
      }
      logPerformance({
        type: "BARALHO_MORBIDO_ASSETS",
        source,
        public: false,
        totalCards: state.baralhoMorbido.totalCards
      });
      emit({ type: "baralho-morbido", baralhoMorbido: publicBaralhoMorbidoSnapshot(state.baralhoMorbido) });
    }

    return {
      changed: result.changed,
      state: publicBaralhoMorbidoSnapshot(state.baralhoMorbido)
    };
  }

  function resetBaralhoMorbido({ source = "controller", cards = state.baralhoMorbido.cards } = {}) {
    clearBaralhoMorbidoTimers();
    const displayConnectionState = {
      displayConnections: state.baralhoMorbido.displayConnections || 0,
      displayConnectedAt: state.baralhoMorbido.displayConnectedAt || null,
      displayDisconnectedAt: state.baralhoMorbido.displayDisconnectedAt || null
    };
    state.baralhoMorbido = {
      ...createInitialBaralhoMorbidoState(cards),
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

  function addMemory(content, { source = "operator", type = "memory", metadata = {} } = {}) {
    const memory = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      source,
      type,
      content,
      ...metadata
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

  function addResearchDiscovery(discovery = {}) {
    if (!discovery.summary) return null;
    const duplicate = [...state.memories].reverse().find((memory) => (
      memory.type === "discovery" &&
      `${memory.content || ""}`.trim().toLowerCase() === `${discovery.summary}`.trim().toLowerCase()
    ));
    if (duplicate) return duplicate;
    return addMemory(discovery.summary, {
      source: "research",
      type: "discovery",
      metadata: {
        discovery: { ...discovery },
        expiresAt: discovery.expiresAt || null,
        relatedParticipants: [...(discovery.relatedParticipants || [])],
        callbackPotential: discovery.interest?.callback_potential || 0,
        dramaturgicalRelevance: discovery.interest?.dramaturgical_relevance || 0
      }
    });
  }

  function addResearchOpenLoop(openLoop = {}) {
    if (!openLoop.fact) return null;
    const duplicate = [...state.research.openLoops].reverse().find((loop) => (
      loop.status === "open" &&
      `${loop.subject}:${loop.fact}`.trim().toLowerCase() === `${openLoop.subject}:${openLoop.fact}`.trim().toLowerCase()
    ));
    if (duplicate) return duplicate;
    const record = {
      id: randomUUID(),
      ...openLoop,
      createdAt: openLoop.createdAt || new Date().toISOString(),
      status: "open"
    };
    state.research.openLoops.push(record);
    state.research.openLoops = state.research.openLoops.slice(-40);
    addMemory(`${record.subject}: ${record.fact}`, {
      source: "research",
      type: "open_loop",
      metadata: {
        openLoopId: record.id,
        relatedParticipants: [...(record.relatedParticipants || [])],
        callbackPotential: record.interest?.callback_potential || 0,
        dramaturgicalRelevance: record.interest?.dramaturgical_relevance || 0
      }
    });
    emit({ type: "research-open-loop", openLoop: record });
    return record;
  }

  function recordResearchActivity(activity = {}) {
    const record = {
      id: randomUUID(),
      timestamp: activity.timestamp || new Date().toISOString(),
      ...activity
    };
    state.research.activity.push(record);
    state.research.activity = state.research.activity.slice(-40);
    logPerformance({
      type: "RESEARCH_ACTIVITY",
      source: "research",
      public: false,
      channel: record.channel,
      action: record.action || record.mode,
      status: record.status,
      text: record.query || record.target || ""
    });
    emit({ type: "research-activity", researchActivity: record });
    return record;
  }

  function controlResearch(patch = {}, { source = "operator" } = {}) {
    state.research = updateResearchSettings(state.research, patch);
    const record = recordResearchActivity({
      channel: "system",
      action: "settings",
      status: "updated",
      source,
      settings: {
        researchEnabled: state.research.researchEnabled,
        autonomousInstagramEnabled: state.research.autonomousInstagramEnabled,
        performativeResearchEnabled: state.research.performativeResearchEnabled,
        budgetMode: state.research.budgetMode
      }
    });
    return { research: { ...state.research }, activity: record };
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
    const embeddedPanelVisible = resolveEmbeddedPanelVisible(state.instagram, nextInstagram);

    state.instagram = {
      ...state.instagram,
      ...nextInstagram,
      embeddedPanelVisible,
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
    clearResearchCache();
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
    // Sound tuning is an operator preference and survives a show reset.
    state.displayBlackout = createInitialDisplayBlackoutState();
    clearSceneCueTimers();
    state.sceneCue = createInitialSceneCueState();
    state.forcaGShaders = createInitialForcaGShaderState();
    state.forcaGSampler = createInitialForcaGSamplerState();
    state.projection = createInitialProjectionState();
    clearSceneZeroTimer();
    clearSceneZeroGincanaTimer();
    clearSceneZeroParticipantTimers();
    clearSceneZeroCollectionTimers();
    state.sceneZero = createInitialSceneZeroState();
    state.research = {
      ...updateResearchSettings(state.research),
      activity: [],
      openLoops: []
    };
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
      embeddedPanelVisible: false,
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

  function signalStopAll({ source = "operator" } = {}) {
    emit({ type: "stop-all", source });
  }

  return {
    addMemory,
    addMessage,
    addResearchDiscovery,
    addResearchOpenLoop,
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
    controlRobotSound,
    controlDisplayBlackout,
    controlForcaGShaders,
    controlForcaGSampler,
    controlSceneZero,
    controlResearch,
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
    recordResearchActivity,
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
    syncBaralhoMorbidoCards,
    setQuedaAviaoDisplayConnection,
    setMode,
    setModel,
    setGameSecret,
    setGlobalVolume,
    setPerformanceIntensity,
    signalStopAll,
    prepareSceneZeroParticipantSelection,
    completeSceneZeroMessageTyping,
    snapshot,
    startGame,
    startHangmanActivity,
    startSuitcases,
    startSceneZeroParticipantSelection,
    stopSceneCue,
    stopGame,
    stopActivities,
    subscribe,
    triggerSceneCue,
    updateSceneAudioCue,
    updateInstagram,
    updateActivity
  };
}

export const showState = globalThis[globalKey]?.startGame && globalThis[globalKey]?.controlStructuredGame && globalThis[globalKey]?.cancelPerformanceEvents && globalThis[globalKey]?.startSuitcases && globalThis[globalKey]?.updateInstagram && globalThis[globalKey]?.drawBaralhoMorbidoCard && globalThis[globalKey]?.syncBaralhoMorbidoCards && globalThis[globalKey]?.controlQuedaAviao && globalThis[globalKey]?.controlGlitch && globalThis[globalKey]?.controlRobotSound && globalThis[globalKey]?.signalStopAll && globalThis[globalKey]?.controlDisplayBlackout && globalThis[globalKey]?.controlForcaGShaders && globalThis[globalKey]?.controlForcaGSampler && globalThis[globalKey]?.controlSceneZero && globalThis[globalKey]?.controlResearch && globalThis[globalKey]?.prepareSceneZeroParticipantSelection && globalThis[globalKey]?.startSceneZeroParticipantSelection && globalThis[globalKey]?.completeSceneZeroMessageTyping && globalThis[globalKey]?.triggerSceneCue && globalThis[globalKey]?.stopSceneCue && globalThis[globalKey]?.updateSceneAudioCue && globalThis[globalKey]?.registerProjectionWindow && globalThis[globalKey]?.setGlobalVolume
  ? globalThis[globalKey]
  : createStore();

globalThis[globalKey] = showState;
