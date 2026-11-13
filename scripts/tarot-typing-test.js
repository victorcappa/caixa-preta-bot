import assert from "node:assert/strict";
import { tarotTypingDelayMs } from "../lib/tarot/typing.js";
import { createTarotState, normalizeTarotConfig, publicTarotSnapshot, restoredTarotState } from "../lib/tarot/state.js";

const text = "A. B.\n\nC.";
assert.equal(tarotTypingDelayMs(text, 0), 60);
assert.equal(tarotTypingDelayMs(text, 1), 60);
assert.equal(tarotTypingDelayMs(text, 2), 560);
assert.equal(tarotTypingDelayMs(text, 5), 1260);
assert.equal(tarotTypingDelayMs(text, 6), 60);
assert.equal(tarotTypingDelayMs(text, 7), 60);
assert.equal(tarotTypingDelayMs(text, text.length), 0);
assert.equal(tarotTypingDelayMs("A.\n\n", 2), 60);
assert.equal(tarotTypingDelayMs("A\r\n \r\nB", 1), 1260);
assert.equal(tarotTypingDelayMs("A.\nB", 2), 560);
assert.equal(tarotTypingDelayMs('"A." B', 3), 60);
assert.equal(tarotTypingDelayMs('"A." B', 4), 560);
assert.equal(tarotTypingDelayMs('“A.”\n\nB', 4), 1260);
assert.equal(tarotTypingDelayMs("A… B", 2), 560);
assert.equal(tarotTypingDelayMs("3.5 vezes", 2), 60);
assert.equal(tarotTypingDelayMs("A... B", 2), 60);
assert.equal(tarotTypingDelayMs("A... B", 3), 60);
assert.equal(tarotTypingDelayMs("A... B", 4), 560);

const fast = { revealSpeed: 4, sentencePauseMs: 850, paragraphPauseMs: 2100 };
assert.equal(tarotTypingDelayMs(text, 1, fast), 15);
assert.equal(tarotTypingDelayMs(text, 2, fast), 865);
assert.equal(tarotTypingDelayMs(text, 5, fast), 2115);
assert.equal(tarotTypingDelayMs(text, 5, { revealSpeed: 4, paragraphPauseMs: 0 }), 15);
assert.equal(tarotTypingDelayMs(text, 2, { sentencePauseMs: 0 }), 60);
assert.equal(tarotTypingDelayMs(text, 5, { revealSpeed: .25, paragraphPauseMs: 1200 }), 1440);

const state = createTarotState();
// Old persisted/hot state acquires defaults in both projections and controls.
delete state.config.sentencePauseMs;
delete state.config.paragraphPauseMs;
assert.equal(publicTarotSnapshot(state).presentation.sentencePauseMs, 500);
assert.equal(publicTarotSnapshot(state).presentation.paragraphPauseMs, 1200);
assert.equal(publicTarotSnapshot(state, true).config.paragraphPauseMs, 1200);
assert.equal(restoredTarotState(state).config.paragraphPauseMs, 1200);
assert.equal(normalizeTarotConfig({ sentencePauseMs: -10 }).sentencePauseMs, 0);
assert.equal(normalizeTarotConfig({ paragraphPauseMs: 20000 }).paragraphPauseMs, 10000);
assert.equal(normalizeTarotConfig({ sentencePauseMs: NaN }).sentencePauseMs, 500);
assert.equal(normalizeTarotConfig({ paragraphPauseMs: 0 }, fast).sentencePauseMs, 850);
assert.equal(normalizeTarotConfig({ paragraphPauseMs: 0 }, fast).paragraphPauseMs, 0);

console.log(JSON.stringify({ ok: true, checks: [
  "fixed character speed; sentence and paragraph holds remain unscaled",
  "one hold before blank lines; quotes, ellipses, CRLF, decimals and final punctuation",
  "explicit zero, bounded values and defaults for old public/private/recovered state"
] }, null, 2));
