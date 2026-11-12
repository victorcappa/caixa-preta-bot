// The current Scene Zero game opens the numbered suitcases in order 2 -> 1 -> 3.
export const SUITCASE_LABELS = { 1: "1", 2: "2", 3: "3" };
export function suitcaseLabel(id) { return SUITCASE_LABELS[id] || "—"; }
