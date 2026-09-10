import {
  SCENE_ZERO_EVIDENCIAS_CHALLENGE,
  SCENE_ZERO_EVIDENCIAS_DURATION_SECONDS,
  SCENE_ZERO_GINCANAS,
  SCENE_ZERO_SMELL_CHALLENGE
} from "../../data/scene-zero-gincanas.js";

export const SCENE_ZERO_SUITCASE_ORDER = [2, 3, 1];
export const SCENE_ZERO_FIRST_CHALLENGE = SCENE_ZERO_EVIDENCIAS_CHALLENGE;
export const SCENE_ZERO_SECOND_CHALLENGE = SCENE_ZERO_SMELL_CHALLENGE;
export const SCENE_ZERO_SUITCASE_CUE_DURATION_MS = 10000;
export const SCENE_ZERO_SUITCASE_ROULETTE_DURATION_MS = 3200;

export function sceneZeroSuitcaseCueFrameAt(elapsedMs, selectedSuitcase) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const selected = Number(selectedSuitcase);
  if (elapsed >= SCENE_ZERO_SUITCASE_ROULETTE_DURATION_MS) {
    return { phase: "reveal", number: selected };
  }
  const interval = Math.max(70, 210 - Math.min(140, elapsed / 24));
  const numbers = [1, 2, 3];
  return {
    phase: "roulette",
    number: numbers[Math.floor(elapsed / interval) % numbers.length]
  };
}

export const SCENE_ZERO_SUITCASES = {
  1: { id: 1, label: "NOVA BIOS", game: "morel_bios" },
  2: { id: 2, label: "EVIDÊNCIAS", game: "gincana" },
  3: { id: 3, label: "OBJETO PELO CHEIRO", game: "gincana" }
};

export function sceneZeroSuitcaseChallenge(suitcaseNumber) {
  return {
    2: SCENE_ZERO_FIRST_CHALLENGE,
    3: SCENE_ZERO_SECOND_CHALLENGE
  }[Number(suitcaseNumber)] || null;
}

export const SCENE_ZERO_INSTAGRAM_TARGETS = {
  robson: { id: "robson", label: "ROBSON", participantName: "Robinson Rogério" },
  janaina: { id: "janaina", label: "JANAÍNA", participantName: "Janaína Leite" }
};

export function openedSceneZeroSuitcases(suitcaseGame = {}) {
  const explicit = Array.isArray(suitcaseGame.openedSuitcases)
    ? suitcaseGame.openedSuitcases.filter((number) => SCENE_ZERO_SUITCASE_ORDER.includes(Number(number))).map(Number)
    : [];
  if (explicit.length) return [...new Set(explicit)];

  const currentIndex = SCENE_ZERO_SUITCASE_ORDER.indexOf(Number(suitcaseGame.currentSuitcase));
  return currentIndex >= 0 ? SCENE_ZERO_SUITCASE_ORDER.slice(0, currentIndex + 1) : [];
}

export function nextSceneZeroSuitcase(suitcaseGame = {}) {
  return SCENE_ZERO_SUITCASE_ORDER[openedSceneZeroSuitcases(suitcaseGame).length] || null;
}

export function buildSuitcaseSelectionCue(suitcaseNumber) {
  const number = Number(suitcaseNumber);
  if (!SCENE_ZERO_SUITCASE_ORDER.includes(number)) return "";
  return `${number}`;
}

export function clampGincanaDuration(value, minimum = 60) {
  const min = Math.max(20, Math.min(60, Math.round(Number(minimum) || 60)));
  return Math.max(min, Math.min(120, Math.round(Number(value) || min)));
}

export function sceneZeroGincanaDuration(task, value) {
  if (task?.id === SCENE_ZERO_FIRST_CHALLENGE.id) return SCENE_ZERO_EVIDENCIAS_DURATION_SECONDS;
  if (task?.id === SCENE_ZERO_SECOND_CHALLENGE.id) return 20;
  return clampGincanaDuration(value, 60);
}

export function shouldShowGincanaTimer(timer) {
  return ["running", "paused", "complete", "completed", "failed"].includes(timer?.status);
}

export function chooseGincana(tasks = SCENE_ZERO_GINCANAS, usedTaskIds = [], random = Math.random) {
  const valid = tasks.filter((task) => task?.id && task?.instruction);
  const unused = valid.filter((task) => !usedTaskIds.includes(task.id));
  const candidates = unused;
  if (!candidates.length) return null;
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}

export function chooseGincanaDuration(task, random = Math.random) {
  const min = sceneZeroGincanaDuration(task, task?.durationMin ?? 60);
  const max = Math.max(min, sceneZeroGincanaDuration(task, task?.durationMax ?? min));
  return min + Math.floor(random() * (max - min + 1));
}

export function buildGincanaPresentation(task, durationSeconds) {
  const duration = sceneZeroGincanaDuration(task, durationSeconds);
  if (task?.presentation) return task.presentation;
  return `Gincana. Você tem ${duration} segundos. ${task.instruction} Começar.`;
}

export function publicGincanaTask(task) {
  if (!task) return null;
  return {
    id: task.id,
    description: task.description || "",
    instruction: task.instruction || "",
    durationMin: sceneZeroGincanaDuration(task, task.durationMin),
    durationMax: sceneZeroGincanaDuration(task, task.durationMax),
    difficulty: task.difficulty || "não informada",
    notes: task.notes || ""
  };
}
