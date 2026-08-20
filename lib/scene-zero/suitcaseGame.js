import { SCENE_ZERO_GINCANAS } from "../../data/scene-zero-gincanas.js";

export const SCENE_ZERO_SUITCASES = {
  1: { id: 1, label: "VERDADE OU BOLO", game: "verdade_ou_bolo" },
  2: { id: 2, label: "GINCANA", game: "gincana" },
  3: { id: 3, label: "VER UMA COISINHA", game: "instagram_glitch" }
};

export const SCENE_ZERO_INSTAGRAM_TARGETS = {
  robson: { id: "robson", label: "ROBSON", participantName: "Robinson Rogério" },
  janaina: { id: "janaina", label: "JANAÍNA", participantName: "Janaína Leite" }
};

export function clampGincanaDuration(value) {
  return Math.max(60, Math.min(120, Math.round(Number(value) || 60)));
}

export function chooseGincana(tasks = SCENE_ZERO_GINCANAS, usedTaskIds = [], random = Math.random) {
  const valid = tasks.filter((task) => task?.id && task?.instruction);
  const unused = valid.filter((task) => !usedTaskIds.includes(task.id));
  const candidates = unused;
  if (!candidates.length) return null;
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}

export function chooseGincanaDuration(task, random = Math.random) {
  const min = clampGincanaDuration(task?.durationMin ?? 60);
  const max = Math.max(min, clampGincanaDuration(task?.durationMax ?? min));
  return min + Math.floor(random() * (max - min + 1));
}

export function publicGincanaTask(task) {
  if (!task) return null;
  return {
    id: task.id,
    description: task.description || "",
    instruction: task.instruction || "",
    durationMin: clampGincanaDuration(task.durationMin),
    durationMax: clampGincanaDuration(task.durationMax),
    difficulty: task.difficulty || "não informada",
    notes: task.notes || ""
  };
}
