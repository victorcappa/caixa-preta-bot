import { robotTypingDelayMs, robotTypingIntervalMs } from "./robot-sound/state.js";

export function liveTrainingTypingDelayMs(settings, text, index) {
  if (index >= text.length) return 0;
  const interval = robotTypingIntervalMs(settings);
  const next = text.slice(index);
  // Wait before the next visible character. This lets streamed blank lines
  // arrive separately without charging a sentence hold and two newline holds.
  if (!index || /^[\s.,;:!?…"'»”’)\]]/u.test(next)) return interval;
  const written = text.slice(0, index);
  const separator = written.match(/\s+$/u)?.[0] || "";
  const configuredPause = robotTypingDelayMs(settings, ",") - interval;
  if (/\r?\n[^\S\r\n]*\r?\n/u.test(separator)) return interval + Math.max(600, configuredPause);
  if (/[.,;:!?…]["'»”’)\]]*\s*$/u.test(written)) {
    if (!separator && /\d[.,:]$/u.test(written) && /^\d/u.test(next)) return interval;
    return interval + Math.max(180, configuredPause);
  }
  return interval;
}
