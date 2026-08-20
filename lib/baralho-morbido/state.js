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

export function createInitialBaralhoMorbidoState(cards = []) {
  const normalizedCards = Array.isArray(cards) ? cards : [];

  return {
    phase: BARALHO_MORBIDO_PHASES.IDLE,
    drawSequence: 0,
    totalCards: normalizedCards.length,
    cards: normalizedCards,
    usedIds: [],
    remainingIds: normalizedCards.map((card) => card.id),
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
    cards: [...(state.cards || [])],
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
  const cards = Array.isArray(state?.cards) ? state.cards : [];
  const base = createInitialBaralhoMorbidoState(cards);
  const cardIds = new Set(cards.map((card) => card.id));
  const usedIds = Array.isArray(state?.usedIds)
    ? state.usedIds.filter((id) => cardIds.has(id))
    : [];
  const remainingIds = cards
    .map((card) => card.id)
    .filter((id) => !usedIds.includes(id));

  return {
    ...base,
    ...(state || {}),
    cards,
    totalCards: cards.length,
    usedIds,
    remainingIds
  };
}

export function syncBaralhoMorbidoCards(currentState, cards, { now = new Date() } = {}) {
  const normalizedCards = Array.isArray(cards) ? cards : [];
  const previousState = normalizeState(currentState);
  const previousSignature = previousState.cards.map((card) => card.video?.file || card.id).join("\n");
  const nextSignature = normalizedCards.map((card) => card.video?.file || card.id).join("\n");

  if (previousSignature === nextSignature) {
    return { changed: false, state: previousState };
  }

  const cardIds = new Set(normalizedCards.map((card) => card.id));
  const usedIds = previousState.usedIds.filter((id) => cardIds.has(id));
  const remainingIds = normalizedCards.map((card) => card.id).filter((id) => !usedIds.includes(id));
  const currentCard = normalizedCards.find((card) => card.id === previousState.currentCard?.id) || null;
  const currentVideo = currentCard?.video || null;
  let phase = currentCard ? previousState.phase : BARALHO_MORBIDO_PHASES.IDLE;

  if (currentCard && previousState.phase === BARALHO_MORBIDO_PHASES.FINISHED && remainingIds.length) {
    phase = BARALHO_MORBIDO_PHASES.PLAYING;
  }

  return {
    changed: true,
    state: {
      ...previousState,
      phase,
      totalCards: normalizedCards.length,
      cards: normalizedCards,
      usedIds,
      remainingIds,
      currentCard,
      currentVideo,
      lastEvent: {
        type: "assets",
        totalCards: normalizedCards.length,
        timestamp: now.toISOString()
      },
      phaseStartedAt: currentCard ? previousState.phaseStartedAt : now.toISOString(),
      updatedAt: now.toISOString()
    }
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
  const selectedCard = state.cards.find((card) => card.id === selectedId);
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
