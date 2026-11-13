import assert from "node:assert/strict";
import { liveTrainingTypingDelayMs as delay } from "../lib/liveTrainingTyping.js";

const settings = { typingIntervalMs: 40, typingPauseMs: 0 };
const text = "A, B.\n\nC!";
assert.equal(delay(settings, text, 0), 40);
assert.equal(delay(settings, text, 1), 40);
assert.equal(delay(settings, text, 2), 40);
assert.equal(delay(settings, text, 3), 220);
assert.equal(delay(settings, text, 5), 40);
assert.equal(delay(settings, text, 6), 40);
assert.equal(delay(settings, text, 7), 640);
assert.equal(delay(settings, text, text.length), 0);
assert.equal(delay(settings, "A. B", 3), 220);
assert.equal(delay(settings, '“A.” B', 5), 220);
assert.equal(delay(settings, "A… B", 3), 220);
assert.equal(delay(settings, "A... B", 2), 40);
assert.equal(delay(settings, "A... B", 5), 220);
assert.equal(delay(settings, "3.5 vezes", 2), 40);
assert.equal(delay(settings, "3,5 vezes", 2), 40);
assert.equal(delay(settings, "15:30", 3), 40);
assert.equal(delay(settings, "A\r\n \r\nB", 6), 640);

// Same cursor progresses across partial buffers: punctuation and both newlines
// stay unpaused; the next paragraph receives exactly one hold when it arrives.
assert.equal(delay(settings, "A.\n", 2), 40);
assert.equal(delay(settings, "A.\n\nB", 3), 40);
assert.equal(delay(settings, "A.\n\nB", 4), 640);
assert.equal(delay({ ...settings, typingIntervalMs: 100 }, "A, B", 3), 280);
assert.equal(delay({ ...settings, typingPauseMs: 900 }, "A, B", 3), 940);
assert.equal(delay({ ...settings, typingPauseMs: 900 }, "A.\n\nB", 4), 940);
console.log(JSON.stringify({ ok: true, checks: [
  "light punctuation and paragraph holds with unchanged character speed",
  "one paragraph hold across split streamed separators; quotes, ellipses and decimals",
  "larger existing operator pauses remain respected"
] }, null, 2));
