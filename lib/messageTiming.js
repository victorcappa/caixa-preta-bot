export const PUBLIC_TYPE_INTERVAL_MS = 42;

export function sequentialMessageSchedule(messages = [], { initialDelayMs = 650, gapMs = 300 } = {}) {
  let cursorMs = Math.max(0, initialDelayMs);
  const offsets = messages.map((message) => {
    const offset = cursorMs;
    const typingDuration = Math.max(PUBLIC_TYPE_INTERVAL_MS, `${message || ""}`.length * PUBLIC_TYPE_INTERVAL_MS);
    cursorMs += typingDuration + Math.max(0, gapMs);
    return offset;
  });

  return {
    offsets,
    totalDurationMs: cursorMs
  };
}
