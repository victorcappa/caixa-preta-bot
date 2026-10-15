import { randomUUID } from "node:crypto";
import { showState } from "@/lib/showState";
import { generateTarotTurn } from "@/lib/openai";
import { readingCards, readingSignature } from "./floor.js";
import { readCatalog } from "./catalog.js";
import { canAutonomousTurn, normalizeNarrative, TAROT_NARRATIVE_VERSION } from "./state.js";

export async function generateTarotResponse({ requestId = randomUUID(), question = "", autonomous = false, automatic = false } = {}) {
  if (automatic) {
    const snapshot = showState.privateSnapshot(), current = snapshot.tarot;
    if (!current.active||current.suspended||current.config.autoAnalyze===false) return { ignored: true };
    if (current.generation === "pending" || current.response?.status === "presenting") return { duplicate: true };
    if (!current.config.repeatOnReturn && current.floor?.phase!=="interpreting") {
      const previous = [...snapshot.conversation].reverse().find((m)=>m.tarot?.narrativeVersion===TAROT_NARRATIVE_VERSION&&(m.tarot.signature||`${m.tarot.cardId}:${m.tarot.version}`)===readingSignature(readingCards(current)));
      if (previous) { showState.controlTarot("restore-presentation", { message: previous }); return { ok: true, resumed: true }; }
    }
  }
  const controller = showState.tarotController;
  const job = controller.begin({requestId,question,autonomous,automatic});
  if (job.duplicate) return { duplicate: true };
  const startedAt = Date.now();
  try {
    const catalog=await readCatalog(),cards=job.cardIds.map((id)=>catalog.find((c)=>c.id===id));
    if(readingSignature(cards)!==job.signature)throw new Error("TAROT_REFERENCE_CHANGED");
    if(cards.some((c)=>!c.description&&!c.elements.length))throw new Error("TAROT_CARD_NOT_PREPARED");
    const generated=await generateTarotTurn({state:showState.privateSnapshot(),card:cards[0],cards,question,signal:job.controller.signal});
    if (!controller.isCurrent(job)) return { cancelled: true };
    const elements=cards.flatMap((card)=>card.elements.map((e)=>({...e,cardId:card.id})));
    const narrative=normalizeNarrative(generated,elements,{maxWords:showState.privateSnapshot().tarot.config.maxWords});
    if(cards.length>1&&cards.some((c)=>!narrative.segments.some((s)=>s.elementIds.some((id)=>c.elements.some((e)=>e.id===id)))))throw new Error("TAROT_JOINT_READING_INCOMPLETE");
    narrative.text = narrative.text.replace(/caixa\s+preta/gi, "o espetáculo");
    narrative.segments = narrative.segments.map((s) => ({ ...s, text: s.text.replace(/caixa\s+preta/gi, "o espetáculo") }));
    if (!controller.finish(job, narrative, elements)) return { cancelled: true };
    return { ok: true, durationMs: Date.now() - startedAt };
  } catch (error) {
    if (!controller.isCurrent(job)) return { cancelled: true };
    controller.fail(job, error?.code || error?.message || "TAROT_API_UNAVAILABLE");
    // No invented analysis or silent prerecorded fallback.
    return { ok: false, error: "TAROT_ANALYSIS_FAILED" };
  }
}

export async function autonomousTarotTurn(preferredId = null) {
  const tarot = showState.privateSnapshot().tarot;
  if (!canAutonomousTurn(tarot)) return { ignored: true };
  const catalog = (await readCatalog()).filter((c) => c.imageUrl && (c.description || c.elements.length));
  const candidates = catalog.filter((c) => !tarot.autonomy.used.includes(c.id) && c.id !== tarot.currentCard?.id);
  const card = preferredId !== null ? catalog.find((c) => c.id === preferredId) : candidates[Math.floor(Math.random() * candidates.length)];
  if (!card) { showState.controlTarot("autonomy-pause"); return { error: "TAROT_NO_REFERENCE" }; }
  showState.controlTarot("autonomy-card", { cardId: card.id });
  showState.controlTarot("select", { card, source: "bot" });
  return generateTarotResponse({ autonomous: true });
}
