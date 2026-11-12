import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";
import { mock } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { AUDIENCE_WARMUP_REQUIRED_ACKNOWLEDGEMENT, AUDIENCE_WARMUP_REQUIRED_TIMER_DELAY_MS } from "../data/audience-warmup-prompts.js";

process.env.CAIXA_PRETA_SHOW_RUNTIME_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "caixa-warmup-transition-"));
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
const { flushSnapshotWrites } = await import("../lib/showSessionPersistence.js");
const initial = showState.privateSnapshot();
const warmup = () => showState.snapshot().audienceWarmup;
function action(name, payload = {}) {
  const result = showState.controlAudienceWarmup(name, payload);
  assert.equal(result.ok, true, `${name}: ${result.error}`);
  return result;
}

mock.timers.enable({ apis: ["Date", "setTimeout"], now: new Date("2026-11-11T12:00:00Z") });
try {
  for (const manualMode of [true, false]) {
    const state = structuredClone(initial);
    state.sceneZero.unlock.status = "HUMAN_VERIFICATION";
    state.audienceWarmup.pendingAdvance = {
      id: "test-questions-start", kind: "questions-start", payload: {},
      dueAt: new Date(Date.now() - 1).toISOString()
    };
    assert.equal(showState.restoreFromRecovery({ storeVersion: showState._storeVersion, sessionId: "transition-test", state }).ok, true);
    action("set-manual-mode", { manualMode: true });
    action("primary-next");
    const messageId = showState.snapshot().publicMessage.id;
    assert.equal(warmup().previewPromptId, "play-dead-30");
    assert.equal(warmup().actionTimer.status, "awaiting_message");
    assert.equal(warmup().actionTimer.endsAt, null);
    action("set-manual-mode", { manualMode });
    showState.completeSceneZeroMessageTyping(messageId);
    showState.completeSceneZeroMessageTyping(messageId);
    assert.equal(warmup().actionTimer.status, "awaiting_start");
    if (manualMode) action("primary-next");
    else {
      mock.timers.tick(AUDIENCE_WARMUP_REQUIRED_TIMER_DELAY_MS - 1);
      assert.equal(warmup().actionTimer.status, "awaiting_start");
      mock.timers.tick(1);
    }
    assert.equal(warmup().actionTimer.status, "running");
    mock.timers.tick(19999);
    assert.equal(warmup().previewPromptId, "play-dead-30");
    mock.timers.tick(1);
    assert.equal(showState.snapshot().publicMessage.content, AUDIENCE_WARMUP_REQUIRED_ACKNOWLEDGEMENT);
    assert.equal(warmup().pendingAdvance.kind, "first-provocation");
    if (manualMode) assert.equal(showState.controlAudienceWarmup("primary-next").ok, false, "acknowledgement must finish before advancing");
    mock.timers.tick(Date.parse(warmup().pendingAdvance.dueAt) - Date.now());
    if (manualMode) {
      assert.equal(showState.snapshot().publicMessage.content, AUDIENCE_WARMUP_REQUIRED_ACKNOWLEDGEMENT);
      action("primary-next");
    }
    assert.match(warmup().previewPromptId, /^provocative-/);
    assert.equal(showState.snapshot().publicMessage.content, warmup().preview);
    assert.equal(warmup().intensity, "provocative");
    console.log(`PASS ${manualMode ? "manual" : "automatic"}: typed instruction → full 20s → acknowledgement → first question`);
  }
} finally {
  showState.startNewPresentation();
  await flushSnapshotWrites();
  mock.timers.reset();
}
