// A clock-driven stability gate: moving a tracked card never creates a new visit.
export function createRecognitionGate() {
  let candidate = null, since = 0, hits = 0, lastSeen = 0, lastId = null, returning = false;
  let submittedId = null, submittedAt = -Infinity;
  return {
    observe(id, now, stabilityMs = 450) {
      if (lastSeen && now - lastSeen > 800) returning = true;
      if (candidate !== id) { candidate = id; since = now; hits = 0; }
      hits++; lastSeen = now; lastId = id;
      return hits >= 3 && now - since >= stabilityMs;
    },
    lost() { candidate = null; hits = 0; },
    isReturning(id) { return returning && id === lastId; },
    wasSubmittedRecently(id, now) { return submittedId === id && now - submittedAt < 1200; },
    submitted(id, now) { submittedId = id; submittedAt = now; returning = false; },
    consumeReturn() { returning = false; }
  };
}
