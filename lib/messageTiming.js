export const PUBLIC_TYPE_INTERVAL_MS = 60;

export function sequentialMessageSchedule(messages = [], {
  initialDelayMs = 650,
  gapMs = 300,
  typingIntervalMs = PUBLIC_TYPE_INTERVAL_MS
} = {}) {
  let cursorMs = Math.max(0, initialDelayMs);
  const safeTypingIntervalMs = Math.max(1, Number(typingIntervalMs) || PUBLIC_TYPE_INTERVAL_MS);
  const offsets = messages.map((message) => {
    const offset = cursorMs;
    const typingDuration = Math.max(safeTypingIntervalMs, `${message || ""}`.length * safeTypingIntervalMs);
    cursorMs += typingDuration + Math.max(0, gapMs);
    return offset;
  });

  return {
    offsets,
    totalDurationMs: cursorMs
  };
}
