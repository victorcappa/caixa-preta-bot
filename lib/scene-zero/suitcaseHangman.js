import { applyHangmanGuess, createHangmanActivity, visibleHangmanProgress } from "../activities.js";
import {
  getSceneZeroHangmanWord,
  SCENE_ZERO_HANGMAN_FLIGHT_STATES,
  SCENE_ZERO_HANGMAN_MAX_ERRORS,
  SCENE_ZERO_HANGMAN_WORDS
} from "../../data/scene-zero-hangman-words.js";

export const SCENE_ZERO_HANGMAN_DURATION_SECONDS = 60;

function createHangmanTimer() {
  return {
    status: "idle",
    durationSeconds: SCENE_ZERO_HANGMAN_DURATION_SECONDS,
    remainingSeconds: SCENE_ZERO_HANGMAN_DURATION_SECONDS,
    startedAt: null,
    endsAt: null,
    completedAt: null,
    sequence: 0
  };
}

export function createInitialSceneZeroHangmanState() {
  return {
    status: "idle",
    wordId: null,
    activity: null,
    manualErrors: 0,
    errorCount: 0,
    flightState: SCENE_ZERO_HANGMAN_FLIGHT_STATES[0],
    lastResult: null,
    resultMessage: null,
    revealedWord: null,
    timer: createHangmanTimer(),
    sequence: 0
  };
}

export function chooseSceneZeroHangmanWord({ excludeIds = [], random = Math.random } = {}) {
  const unused = SCENE_ZERO_HANGMAN_WORDS.filter((entry) => !excludeIds.includes(entry.id));
  const options = unused.length ? unused : SCENE_ZERO_HANGMAN_WORDS;
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))] || null;
}

function flightStateFor(errorCount) {
  return SCENE_ZERO_HANGMAN_FLIGHT_STATES[Math.min(
    SCENE_ZERO_HANGMAN_FLIGHT_STATES.length - 1,
    Math.max(0, Number(errorCount) || 0)
  )];
}

function completedProgress(activity) {
  return visibleHangmanProgress(
    activity.privateState.secretWord,
    [...new Set(activity.privateState.secretWord.split(""))],
    activity.privateState.displayWord
  );
}

function finishHangman(state, status, resultMessage, lastResult = state.lastResult) {
  const now = new Date();
  const liveRemaining = state.timer?.status === "running" && state.timer.endsAt
    ? Math.max(0, Math.ceil((Date.parse(state.timer.endsAt) - now.getTime()) / 1000))
    : Math.max(0, Number(state.timer?.remainingSeconds) || 0);
  const activity = {
    ...state.activity,
    status: "completed",
    step: "completed",
    updatedAt: new Date().toISOString(),
    publicState: {
      ...state.activity.publicState,
      progress: completedProgress(state.activity)
    }
  };
  return {
    ...state,
    status,
    activity,
    errorCount: status === "lost" ? SCENE_ZERO_HANGMAN_MAX_ERRORS : state.errorCount,
    flightState: status === "lost" ? flightStateFor(SCENE_ZERO_HANGMAN_MAX_ERRORS) : state.flightState,
    resultMessage,
    lastResult,
    revealedWord: state.activity.privateState.displayWord.toUpperCase(),
    timer: {
      ...createHangmanTimer(),
      ...(state.timer || {}),
      status: "complete",
      remainingSeconds: liveRemaining,
      endsAt: null,
      completedAt: now.toISOString(),
      sequence: Number(state.timer?.sequence || 0) + 1
    },
    sequence: state.sequence + 1
  };
}

export function configureSceneZeroHangman(current = createInitialSceneZeroHangmanState(), wordId, { start = false } = {}) {
  const entry = getSceneZeroHangmanWord(wordId) || chooseSceneZeroHangmanWord();
  if (!entry) return null;
  const activity = createHangmanActivity({
    word: entry.text,
    displayWord: entry.text,
    maxErrors: SCENE_ZERO_HANGMAN_MAX_ERRORS,
    source: "scene-zero-suitcase"
  });
  activity.status = start ? "active" : "paused";
  const now = new Date();
  return {
    ...createInitialSceneZeroHangmanState(),
    status: start ? "active" : "ready",
    wordId: entry.id,
    activity,
    timer: start ? {
      ...createHangmanTimer(),
      status: "running",
      startedAt: now.toISOString(),
      endsAt: new Date(now.getTime() + SCENE_ZERO_HANGMAN_DURATION_SECONDS * 1000).toISOString(),
      sequence: Number(current.timer?.sequence || 0) + 1
    } : {
      ...createHangmanTimer(),
      sequence: Number(current.timer?.sequence || 0) + 1
    },
    sequence: Number(current.sequence || 0) + 1
  };
}

export function startSceneZeroHangman(current) {
  if (!current?.activity) return null;
  const now = new Date();
  return {
    ...current,
    status: "active",
    activity: { ...current.activity, status: "active", step: "guess", updatedAt: new Date().toISOString() },
    resultMessage: null,
    revealedWord: null,
    timer: {
      ...createHangmanTimer(),
      status: "running",
      startedAt: now.toISOString(),
      endsAt: new Date(now.getTime() + SCENE_ZERO_HANGMAN_DURATION_SECONDS * 1000).toISOString(),
      sequence: Number(current.timer?.sequence || 0) + 1
    },
    sequence: current.sequence + 1
  };
}

export function guessSceneZeroHangman(current, guess) {
  if (current?.status !== "active" || !current.activity) return null;
  const applied = applyHangmanGuess(current.activity, guess);
  if (!applied) return null;
  const errorCount = Math.min(
    SCENE_ZERO_HANGMAN_MAX_ERRORS,
    applied.activity.publicState.wrongGuesses.length + Number(current.manualErrors || 0)
  );
  const next = {
    ...current,
    activity: applied.activity,
    errorCount,
    flightState: flightStateFor(errorCount),
    lastResult: applied.result,
    sequence: current.sequence + 1
  };
  if (!applied.activity.publicState.progress.includes("_")) {
    return finishHangman(next, "won", "REGISTRO RECUPERADO.");
  }
  if (errorCount >= SCENE_ZERO_HANGMAN_MAX_ERRORS || applied.result === "failed") {
    return finishHangman(next, "lost", "IMPACTO.");
  }
  return { ...next, activity: { ...applied.activity, status: "active" } };
}

export function addSceneZeroHangmanError(current) {
  if (current?.status !== "active" || !current.activity) return null;
  const manualErrors = Number(current.manualErrors || 0) + 1;
  const errorCount = Math.min(
    SCENE_ZERO_HANGMAN_MAX_ERRORS,
    current.activity.publicState.wrongGuesses.length + manualErrors
  );
  const next = {
    ...current,
    manualErrors,
    errorCount,
    flightState: flightStateFor(errorCount),
    lastResult: "manual-error",
    sequence: current.sequence + 1
  };
  return errorCount >= SCENE_ZERO_HANGMAN_MAX_ERRORS
    ? finishHangman(next, "lost", "IMPACTO.")
    : next;
}

export function revealSceneZeroHangman(current) {
  if (!current?.activity) return null;
  return finishHangman(current, "revealed", "REGISTRO EXPOSTO.");
}

export function winSceneZeroHangman(current) {
  if (!current?.activity) return null;
  return finishHangman(current, "won", "REGISTRO RECUPERADO.");
}

export function loseSceneZeroHangman(current) {
  if (!current?.activity) return null;
  return finishHangman(current, "lost", "IMPACTO.");
}

export function timeoutSceneZeroHangman(current) {
  if (current?.status !== "active" || !current.activity) return null;
  return finishHangman(current, "lost", "TEMPO ESGOTADO.", "timeout");
}

export function cancelSceneZeroHangman(current) {
  if (!current?.activity) return current;
  return {
    ...current,
    status: "cancelled",
    activity: { ...current.activity, status: "paused", updatedAt: new Date().toISOString() },
    timer: {
      ...createHangmanTimer(),
      status: "cancelled",
      sequence: Number(current.timer?.sequence || 0) + 1
    },
    sequence: current.sequence + 1
  };
}

export function publicSceneZeroHangman(state = createInitialSceneZeroHangmanState()) {
  return {
    ...state,
    activity: state.activity ? {
      id: state.activity.id,
      type: state.activity.type,
      status: state.activity.status,
      source: state.activity.source,
      createdAt: state.activity.createdAt,
      updatedAt: state.activity.updatedAt,
      step: state.activity.step,
      publicState: {
        ...state.activity.publicState,
        wrongGuesses: [...(state.activity.publicState?.wrongGuesses || [])],
        usedGuesses: [...(state.activity.publicState?.usedGuesses || [])]
      }
    } : null
  };
}
