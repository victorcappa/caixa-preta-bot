import { SCENE_ZERO_PHYSICAL_CHALLENGES } from "../../data/scene-zero-physical-challenges.js";

export const SCENE_ZERO_SUITCASE_ORDER = [2, 3, 1];
export const SCENE_ZERO_FIRST_CHALLENGE = SCENE_ZERO_PHYSICAL_CHALLENGES[0];
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
  1: { id: 1, label: "FIM DO TUTORIAL", game: "tutorial_end" },
  2: { id: 2, label: "DESAFIO COM OBJETO", game: "physical_challenge" },
  3: { id: 3, label: "FORCA / QUEDA", game: "hangman" }
};

export function sceneZeroSuitcaseChallenge(suitcaseNumber, usedTaskIds = [], random = Math.random) {
  return Number(suitcaseNumber) === 2
    ? chooseGincana(SCENE_ZERO_PHYSICAL_CHALLENGES, usedTaskIds, random)
    : null;
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

export function clampGincanaDuration(value, minimum = 5) {
  const min = Math.max(1, Math.min(60, Math.round(Number(minimum) || 5)));
  return Math.max(min, Math.min(120, Math.round(Number(value) || min)));
}

export function sceneZeroGincanaDuration(task, value) {
  return clampGincanaDuration(value ?? task?.duration, task?.duration ?? 5);
}

export function shouldShowGincanaTimer(timer) {
  return ["running", "paused", "complete", "completed", "failed"].includes(timer?.status);
}

export function chooseGincana(tasks = SCENE_ZERO_PHYSICAL_CHALLENGES, usedTaskIds = [], random = Math.random) {
  const valid = tasks.filter((task) => task?.id && (task?.text || task?.instruction));
  const unused = valid.filter((task) => !usedTaskIds.includes(task.id));
  const candidates = unused.length ? unused : valid;
  if (!candidates.length) return null;
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}

export function chooseGincanaDuration(task, random = Math.random) {
  if (task?.duration) return sceneZeroGincanaDuration(task, task.duration);
  const min = sceneZeroGincanaDuration(task, task?.durationMin ?? 5);
  const max = Math.max(min, sceneZeroGincanaDuration(task, task?.durationMax ?? min));
  return min + Math.floor(random() * (max - min + 1));
}

export function buildGincanaPresentation(task, durationSeconds) {
  if (task?.presentation) return task.presentation;
  const instruction = task?.text || task?.instruction || "DESAFIO NÃO CONFIGURADO.";
  const mandatoryAction = task?.mandatoryAction
    ? `EM SEGUIDA, POR ${task.mandatoryDuration || 30} SEGUNDOS: ${task.mandatoryAction}`
    : "";
  return [instruction, mandatoryAction].filter(Boolean).join(" ");
}

export function publicGincanaTask(task) {
  if (!task) return null;
  return {
    id: task.id,
    text: task.text || task.instruction || "",
    description: task.description || "",
    instruction: task.instruction || task.text || "",
    target: Math.max(1, Number(task.target) || 1),
    objectDuration: Math.max(1, Number(task.objectDuration) || 1),
    mandatoryAction: task.mandatoryAction || "",
    mandatoryDuration: Math.max(0, Number(task.mandatoryDuration) || 0),
    duration: sceneZeroGincanaDuration(task, task.duration),
    durationMin: sceneZeroGincanaDuration(task, task.duration ?? task.durationMin),
    durationMax: sceneZeroGincanaDuration(task, task.duration ?? task.durationMax),
    category: task.category || "físico",
    intensity: task.intensity || "média",
    successMessage: task.successMessage || "DESAFIO CONCLUÍDO.",
    failureMessage: task.failureMessage || "INSUFICIENTE.",
    difficulty: task.difficulty || "não informada",
    notes: task.notes || ""
  };
}
