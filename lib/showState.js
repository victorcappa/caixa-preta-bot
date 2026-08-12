import { randomUUID } from "crypto";
import { createHangmanActivity } from "@/lib/activities";
import {
  advanceGame as advanceGameState,
  applyGameMove as applyGameMoveState,
  createGameLogEntry,
  createInitialGameState,
  evaluateGameOpportunity,
  publicGameSnapshot,
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
    participants: {
      session: [],
      history: {}
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
      participants: {
        session: state.participants.session.map((participant) => ({ ...participant })),
        history: { ...state.participants.history },
        counts: participantPool.counts,
        pool: participantPool.participants
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

  function startGame({ requestedGame = null, source = "operator" } = {}) {
    const result = startGameState(privateSnapshot(), { requestedGame, source });
    state.game = result.gameState;
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

    emit({ type: "game-start", game: publicGameSnapshot(state.game) });
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
    state.game = tickGameAfterTurn(privateSnapshot());
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
    state.participants = {
      session: [],
      history: {}
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
    applyGameMove,
    approvePhoneProjection,
    completeTurnGameTick,
    clearPerformance,
    completePerformanceEvent,
    getGameOpportunity,
    hidePhoneProjection,
    privateSnapshot,
    queuePerformanceEvents,
    reset,
    setMode,
    setModel,
    setPerformanceIntensity,
    snapshot,
    startGame,
    startHangmanActivity,
    stopGame,
    stopActivities,
    subscribe,
    updateActivity
  };
}

export const showState = globalThis[globalKey]?.startGame ? globalThis[globalKey] : createStore();

globalThis[globalKey] = showState;
