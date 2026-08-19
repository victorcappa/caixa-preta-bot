import { BARALHO_MORBIDO_CARDS, BARALHO_MORBIDO_TOTAL_CARDS } from "./config.js";

export const BARALHO_MORBIDO_PHASES = {
  IDLE: "IDLE",
  SHUFFLING: "SHUFFLING",
  SELECTING: "SELECTING",
  REVEALING: "REVEALING",
  PLAYING: "PLAYING",
  FINISHED: "FINISHED"
};

export const BARALHO_MORBIDO_TIMELINE_MS = {
  selecting: 3000,
  revealing: 4100,
  playing: 5200
};

const BUSY_PHASES = new Set([
  BARALHO_MORBIDO_PHASES.SHUFFLING,
  BARALHO_MORBIDO_PHASES.SELECTING,
  BARALHO_MORBIDO_PHASES.REVEALING
]);

export function createInitialBaralhoMorbidoState() {
  return {
    phase: BARALHO_MORBIDO_PHASES.IDLE,
    drawSequence: 0,
    totalCards: BARALHO_MORBIDO_TOTAL_CARDS,
    cards: BARALHO_MORBIDO_CARDS,
    usedIds: [],
    remainingIds: BARALHO_MORBIDO_CARDS.map((card) => card.id),
    currentCard: null,
    currentVideo: null,
    lastEvent: null,
    displayConnections: 0,
    displayConnectedAt: null,
    displayDisconnectedAt: null,
    phaseStartedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function publicBaralhoMorbidoSnapshot(state = createInitialBaralhoMorbidoState()) {
  return {
    ...state,
    cards: state.cards || BARALHO_MORBIDO_CARDS,
    usedIds: [...(state.usedIds || [])],
    remainingIds: [...(state.remainingIds || [])],
    currentCard: state.currentCard ? { ...state.currentCard, video: { ...state.currentCard.video } } : null,
    currentVideo: state.currentVideo ? { ...state.currentVideo } : null,
    lastEvent: state.lastEvent ? { ...state.lastEvent } : null
  };
}

export function isBaralhoMorbidoBusy(state) {
  return BUSY_PHASES.has(state?.phase);
}

function normalizeState(state) {
  const base = createInitialBaralhoMorbidoState();
  const usedIds = Array.isArray(state?.usedIds) ? state.usedIds : [];
  const remainingIds = BARALHO_MORBIDO_CARDS
    .map((card) => card.id)
    .filter((id) => !usedIds.includes(id));

  return {
    ...base,
    ...(state || {}),
    cards: BARALHO_MORBIDO_CARDS,
    totalCards: BARALHO_MORBIDO_TOTAL_CARDS,
    usedIds,
    remainingIds
  };
}

export function drawBaralhoMorbidoCard(currentState, { now = new Date(), random = Math.random } = {}) {
  const state = normalizeState(currentState);

  if (isBaralhoMorbidoBusy(state)) {
    return {
      applied: false,
      reason: "busy",
      state
    };
  }

  if (!state.remainingIds.length) {
    const finishedState = {
      ...state,
      phase: BARALHO_MORBIDO_PHASES.FINISHED,
      lastEvent: {
        type: "all_revealed",
        timestamp: now.toISOString()
      },
      phaseStartedAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    return {
      applied: false,
      reason: "finished",
      state: finishedState
    };
  }

  const drawIndex = Math.min(state.remainingIds.length - 1, Math.floor(random() * state.remainingIds.length));
  const selectedId = state.remainingIds[drawIndex];
  const selectedCard = BARALHO_MORBIDO_CARDS.find((card) => card.id === selectedId);
  const usedIds = [...state.usedIds, selectedId];
  const remainingIds = state.remainingIds.filter((id) => id !== selectedId);
  const drawSequence = (Number(state.drawSequence) || 0) + 1;

  return {
    applied: true,
    card: selectedCard,
    state: {
      ...state,
      phase: BARALHO_MORBIDO_PHASES.SHUFFLING,
      drawSequence,
      usedIds,
      remainingIds,
      currentCard: selectedCard,
      currentVideo: selectedCard.video,
      lastEvent: {
        type: "draw",
        cardId: selectedId,
        sequence: drawSequence,
        timestamp: now.toISOString()
      },
      phaseStartedAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
  };
}

export function setBaralhoMorbidoPhase(currentState, phase, { now = new Date() } = {}) {
  const state = normalizeState(currentState);
  const nextPhase = Object.values(BARALHO_MORBIDO_PHASES).includes(phase)
    ? phase
    : state.phase;

  return {
    ...state,
    phase: nextPhase,
    phaseStartedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    lastEvent: {
      type: "phase",
      phase: nextPhase,
      sequence: state.drawSequence,
      timestamp: now.toISOString()
    }
  };
}
