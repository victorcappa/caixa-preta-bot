export const DEFAULT_TAROT_TYPING = {
  revealSpeed: 1,
  sentencePauseMs: 500,
  paragraphPauseMs: 1200
};

function bounded(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

// Index is the number of characters already shown. Hold once, before the
// separator, so a period followed by a blank line never incurs three pauses.
export function tarotTypingDelayMs(text = "", index = 0, presentation = {}) {
  if (index >= text.length) return 0;
  const interval = 60 / bounded(presentation.revealSpeed, .25, 4, DEFAULT_TAROT_TYPING.revealSpeed);
  if (index <= 0 || /\s/u.test(text[index - 1])) return interval;
  const rest = text.slice(index);
  if (!rest.trim()) return interval;
  const separator = rest.match(/^\s+/u)?.[0] || "";
  if (/\r?\n[^\S\r\n]*\r?\n/u.test(separator)) {
    return interval + bounded(presentation.paragraphPauseMs, 0, 10000, DEFAULT_TAROT_TYPING.paragraphPauseMs);
  }
  // Finish ellipses and closing quotes before holding at the sentence boundary.
  if (separator && /[.!?…]["'»”’)\]]*$/u.test(text.slice(0, index))) {
    return interval + bounded(presentation.sentencePauseMs, 0, 5000, DEFAULT_TAROT_TYPING.sentencePauseMs);
  }
  return interval;
}
