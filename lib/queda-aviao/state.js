import {
  buildSegments,
  DEFAULT_FADE_MS,
  scriptLines,
  subdivisionOptions
} from "@/app/queda-aviao/script";

export const QUEDA_AVIAO_PHASES = {
  ENTERING: "entering",
  VISIBLE: "visible",
  EXITING: "exiting"
};

const SUBDIVISIONS = new Set(subdivisionOptions.map((option) => option.value));
const PHASES = new Set(Object.values(QUEDA_AVIAO_PHASES));

export function createInitialQuedaAviaoState() {
  const now = new Date().toISOString();

  return {
    rawText: scriptLines.join("\n"),
    subdivision: "line",
    fadeMs: DEFAULT_FADE_MS,
    pace: 1,
    stageMultiplier: 1,
    autoPlay: true,
    loop: true,
    currentIndex: 0,
    phase: QUEDA_AVIAO_PHASES.ENTERING,
    playbackSequence: 0,
    displayConnections: 0,
    displayConnectedAt: null,
    displayDisconnectedAt: null,
    lastEvent: null,
    updatedAt: now
  };
}

export function publicQuedaAviaoSnapshot(state = createInitialQuedaAviaoState()) {
  const normalized = normalizeQuedaAviaoState(state);
  const segments = getQuedaAviaoSegments(normalized);

  return {
    ...normalized,
    currentIndex: clampIndex(normalized.currentIndex, segments.length),
    segments,
    currentSegment: segments[clampIndex(normalized.currentIndex, segments.length)] || null
  };
}

export function getQuedaAviaoSegments(state) {
  const normalized = normalizeQuedaAviaoState(state);
  return buildSegments(normalized.rawText.split("\n").map((line) => line.trim()).filter(Boolean), normalized.subdivision, {
    pace: normalized.pace,
    stageMultiplier: normalized.stageMultiplier
  });
}

export function normalizeQuedaAviaoState(state) {
  const base = createInitialQuedaAviaoState();
  const next = {
    ...base,
    ...(state || {})
  };
  const rawText = normalizeRawText(next.rawText);
  const subdivision = SUBDIVISIONS.has(next.subdivision) ? next.subdivision : base.subdivision;
  const pace = clampNumber(next.pace, 0.35, 2, base.pace);
  const stageMultiplier = clampNumber(next.stageMultiplier, 0.5, 2.5, base.stageMultiplier);
  const segments = buildSegments(toSourceLines(rawText), subdivision, { pace, stageMultiplier });

  return {
    ...next,
    rawText,
    subdivision,
    fadeMs: clampNumber(next.fadeMs, 0, 3000, base.fadeMs),
    pace,
    stageMultiplier,
    autoPlay: Boolean(next.autoPlay),
    loop: Boolean(next.loop),
    currentIndex: clampIndex(next.currentIndex, segments.length),
    phase: PHASES.has(next.phase) ? next.phase : base.phase,
    playbackSequence: Number(next.playbackSequence) || 0,
    displayConnections: Math.max(0, Number(next.displayConnections) || 0)
  };
}

export function updateQuedaAviaoState(currentState, patch = {}, { now = new Date() } = {}) {
  const state = normalizeQuedaAviaoState(currentState);
  const shouldRestartFade = ["rawText", "subdivision", "currentIndex"].some((key) => (
    Object.prototype.hasOwnProperty.call(patch, key)
  ));
  const next = {
    ...state,
    ...pickPatch(patch),
    phase: shouldRestartFade
      ? (state.fadeMs > 0 ? QUEDA_AVIAO_PHASES.ENTERING : QUEDA_AVIAO_PHASES.VISIBLE)
      : state.phase,
    updatedAt: now.toISOString()
  };
  const normalized = normalizeQuedaAviaoState(next);

  return {
    ...normalized,
    playbackSequence: state.playbackSequence + 1,
    lastEvent: {
      type: "update",
      timestamp: now.toISOString()
    }
  };
}

export function setQuedaAviaoIndex(currentState, index, { now = new Date() } = {}) {
  const state = normalizeQuedaAviaoState(currentState);
  const segments = getQuedaAviaoSegments(state);
  const nextIndex = clampIndex(index, segments.length);

  return {
    ...state,
    currentIndex: nextIndex,
    phase: state.fadeMs > 0 ? QUEDA_AVIAO_PHASES.ENTERING : QUEDA_AVIAO_PHASES.VISIBLE,
    playbackSequence: state.playbackSequence + 1,
    updatedAt: now.toISOString(),
    lastEvent: {
      type: "set-index",
      index: nextIndex,
      timestamp: now.toISOString()
    }
  };
}

export function advanceQuedaAviao(currentState, delta = 1, { now = new Date() } = {}) {
  const state = normalizeQuedaAviaoState(currentState);
  const segments = getQuedaAviaoSegments(state);

  if (!segments.length) {
    return setQuedaAviaoIndex(state, 0, { now });
  }

  const rawIndex = state.currentIndex + delta;
  const nextIndex = state.loop
    ? (rawIndex + segments.length) % segments.length
    : clampIndex(rawIndex, segments.length);

  return {
    ...state,
    currentIndex: nextIndex,
    autoPlay: state.autoPlay && (state.loop || rawIndex < segments.length),
    phase: state.fadeMs > 0 ? QUEDA_AVIAO_PHASES.ENTERING : QUEDA_AVIAO_PHASES.VISIBLE,
    playbackSequence: state.playbackSequence + 1,
    updatedAt: now.toISOString(),
    lastEvent: {
      type: "advance",
      delta,
      index: nextIndex,
      timestamp: now.toISOString()
    }
  };
}

export function resetQuedaAviaoState(currentState, { now = new Date() } = {}) {
  const connectionState = {
    displayConnections: currentState?.displayConnections || 0,
    displayConnectedAt: currentState?.displayConnectedAt || null,
    displayDisconnectedAt: currentState?.displayDisconnectedAt || null
  };

  return {
    ...createInitialQuedaAviaoState(),
    ...connectionState,
    playbackSequence: (Number(currentState?.playbackSequence) || 0) + 1,
    updatedAt: now.toISOString(),
    lastEvent: {
      type: "reset",
      timestamp: now.toISOString()
    }
  };
}

export function setQuedaAviaoDisplayConnection(currentState, connected, { now = new Date() } = {}) {
  const state = normalizeQuedaAviaoState(currentState);
  const displayConnections = connected
    ? state.displayConnections + 1
    : Math.max(0, state.displayConnections - 1);

  return {
    ...state,
    displayConnections,
    displayConnectedAt: connected ? now.toISOString() : state.displayConnectedAt,
    displayDisconnectedAt: connected ? state.displayDisconnectedAt : now.toISOString(),
    updatedAt: now.toISOString(),
    lastEvent: {
      type: connected ? "display-connect" : "display-disconnect",
      timestamp: now.toISOString()
    }
  };
}

function pickPatch(patch) {
  const allowed = [
    "rawText",
    "subdivision",
    "fadeMs",
    "pace",
    "stageMultiplier",
    "autoPlay",
    "loop",
    "currentIndex",
    "phase"
  ];

  return allowed.reduce((picked, key) => {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      picked[key] = patch[key];
    }

    return picked;
  }, {});
}

function normalizeRawText(rawText) {
  const text = typeof rawText === "string" ? rawText : scriptLines.join("\n");
  const lines = toSourceLines(text);

  return lines.length ? lines.join("\n") : scriptLines.join("\n");
}

function toSourceLines(rawText) {
  return `${rawText || ""}`.split("\n").map((line) => line.trim()).filter(Boolean);
}

function clampIndex(index, length) {
  if (length <= 0) {
    return 0;
  }

  return Math.min(Math.max(Number(index) || 0, 0), length - 1);
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(Math.max(numeric, min), max);
}
