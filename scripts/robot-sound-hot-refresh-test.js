import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { normalizeRobotSoundSettings, publicRobotSoundSnapshot } from "../lib/robot-sound/state.js";

process.env.CAIXA_PRETA_SHOW_RUNTIME_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "caixa-sound-schema-"));
registerHooks({ resolve(specifier, context, nextResolve) {
  let url;
  if (specifier.startsWith("@/")) url = pathToFileURL(path.resolve(specifier.slice(2))).href;
  else if (specifier.startsWith(".")) url = new URL(specifier, context.parentURL).href;
  if (url?.startsWith("file:") && !path.extname(fileURLToPath(url)) && fs.existsSync(`${fileURLToPath(url)}.js`)) {
    return nextResolve(`${url}.js`, context);
  }
  return nextResolve(url || specifier, context);
} });

const { showState } = await import("../lib/showState.js");
showState.addMessage("assistant", "SCHEMA REFRESH MARKER", "test");
const oldSchema = (settings, base) => {
  const result = normalizeRobotSoundSettings(settings, base);
  delete result.typingPauseMs;
  delete result.messageGapMs;
  return result;
};
showState._refreshRobotSoundSettings(oldSchema, oldSchema);
assert.equal(showState.controlRobotSound({ typingPauseMs: 700 }).typingPauseMs, undefined);
const before = showState.privateSnapshot();
let events = 0;
const unsubscribe = showState.subscribe(() => { events += 1; });
showState._refreshRobotSoundSettings(normalizeRobotSoundSettings, publicRobotSoundSnapshot);
const changed = showState.controlRobotSound({ typingIntervalMs: 100, typingPauseMs: 700, messageGapMs: 1200 });
assert.equal(changed.typingPauseMs, 700);
assert.equal(changed.messageGapMs, 1200);
assert.equal(changed.typingIntervalMs, 100);
const refreshed = (await import("../lib/showState.js?hot-refresh")).showState;
assert.equal(refreshed, showState, "hot refresh keeps the same live singleton");
assert.equal(refreshed.snapshot().robotSound.typingPauseMs, 700);
assert.deepEqual(refreshed.privateSnapshot().conversation, before.conversation);
assert.deepEqual(refreshed.snapshot().sceneZero, before.sceneZero);
assert.equal(events, 2, "existing listeners remain attached to the refreshed store");
unsubscribe();
console.log("PASS sound schema hot refresh preserves singleton, scene, history, listeners and saved timing");
