// The authored game order 2 -> 3 -> 1 is physically Centro -> Esquerda -> Direita.
export const SUITCASE_LABELS = { 1: "Direita", 2: "Centro", 3: "Esquerda" };
export function suitcaseLabel(id) { return SUITCASE_LABELS[id] || "—"; }
