import { normalizeNarrative } from "./state.js";

// A malformed model response gets one correction, within the same cancellable
// job. Network/provider errors still fail immediately; no prerecorded reading.
export async function generateValidatedNarrative({ generate, cards, maxWords, signal }) {
  const elements = cards.flatMap((card) => card.elements.map((element) => ({ ...element, cardId: card.id })));
  let repairReason = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    signal?.throwIfAborted();
    try {
      const generated = await generate({ repairReason });
      signal?.throwIfAborted();
      const narrative = normalizeNarrative(generated, elements, { maxWords });
      if (cards.length > 1 && cards.some((card) => !narrative.segments.some((segment) => segment.elementIds.some((id) => card.elements.some((element) => element.id === id))))) {
        throw new Error("TAROT_JOINT_READING_INCOMPLETE");
      }
      return narrative;
    } catch (error) {
      signal?.throwIfAborted();
      const invalid = error instanceof SyntaxError || /^TAROT_(?:NARRATIVE_(?:TOO_LONG|INCOMPLETE|INVALID)|JOINT_READING_INCOMPLETE)$/.test(error?.message || "");
      if (attempt || !invalid) throw error;
      repairReason = error instanceof SyntaxError ? "TAROT_NARRATIVE_INVALID" : error.message;
    }
  }
}
