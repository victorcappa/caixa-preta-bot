export function sanitizePublicTextForProjection(text = "") {
  return `${text || ""}`
    .replace(/\b[^.!?\n]*(?:\([^)]*(?:ask_question|suitcase|gameMove|game\.gameMove|envelope|JSON|campo estruturado)[^)]*\))[^.!?\n]*[.!?]?\s*/gi, "")
    .replace(/\b(?:entendido|certo|ok|registrado)\.?\s*(?:vou\s+)?(?:registrar|mandar|enviar|usar)[^.!?\n]*(?:suitcase|ask_question|gameMove|envelope|JSON|campo estruturado|pergunta formal)[^.!?\n]*[.!?]?\s*/gi, "")
    .replace(/\b(?:vou|devo|preciso)\s+(?:fazer|registrar|mandar|enviar|usar)[^.!?\n]*(?:suitcase|ask_question|gameMove|envelope|JSON|campo estruturado|pergunta formal)[^.!?\n]*[.!?]?\s*/gi, "")
    .replace(/\([^)]*(?:ask_question|suitcase|gameMove|game\.gameMove|envelope|JSON|campo estruturado)[^)]*\)/gi, "")
    .replace(/\b(?:suitcase\.action|suitcase|ask_question|gameMove|game\.gameMove|envelope JSON|JSON estruturado|campo estruturado|pergunta formal)\b/gi, "")
    .replace(/\b(?:entendido|certo|registrado)\.\s+(?=(?:proxima|essa|esse|sou|era|publico)\b)/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
