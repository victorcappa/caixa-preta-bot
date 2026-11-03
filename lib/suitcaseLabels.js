// Physical positions preserve the existing internal IDs and sequence.
export const SUITCASE_LABELS = { 1: "Esquerda", 2: "Centro", 3: "Direita" };
export function suitcaseLabel(id) { return SUITCASE_LABELS[id] || "—"; }
