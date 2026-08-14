import { randomUUID } from "crypto";
import { createHangmanActivity } from "@/lib/activities";
import {
  advanceGame as advanceGameState,
  applyGameMove as applyGameMoveState,
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

function createStore() {
  const listeners = new Set();
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
    clearPerformance,
    completePerformanceEvent,
    finishInstagramTimer,
    finishSuitcases,
    forceSuitcaseExperience,
    getGameOpportunity,
    hidePhoneProjection,
    nextInstagramPerson,
    privateSnapshot,
    queuePerformanceEvents,
    reset,
    resetSuitcases,
    setMode,
    setModel,
    setGameSecret,
    setPerformanceIntensity,
    snapshot,
    startGame,
    startHangmanActivity,
    startSuitcases,
    stopGame,
    stopActivities,
    subscribe,
    updateInstagram,
    updateActivity
  };
}

export const showState = globalThis[globalKey]?.startGame && globalThis[globalKey]?.cancelPerformanceEvents && globalThis[globalKey]?.startSuitcases && globalThis[globalKey]?.updateInstagram
  ? globalThis[globalKey]
  : createStore();

globalThis[globalKey] = showState;
