const assert = require("node:assert/strict");

async function main() {
  const eventsModule = await import("../lib/performanceEvents.js");
  const activitiesModule = await import("../lib/activities.js");
  const countdownTextModule = await import("../lib/countdownText.js");
  const interactionModule = await import("../lib/interactionHistory.js");

  const {
    PERFORMANCE_EVENT_TYPES,
    normalizePerformanceEvent,
    normalizePerformanceEvents,
    performanceCapabilitiesBlock
  } = eventsModule;
  const {
    ACTIVITY_TYPES,
    applyHangmanGuess,
    createHangmanActivity
  } = activitiesModule;
  const {
    buildInteractionHistoryBlock
  } = interactionModule;
  const {
    inferCountdownDurationFromText
  } = countdownTextModule;

  const fullscreen = normalizePerformanceEvent({
    type: PERFORMANCE_EVENT_TYPES.fullscreenText,
    durationMs: 999999,
    payload: { text: "BOLA".repeat(100) }
  });

  assert.equal(fullscreen.type, "FULLSCREEN_TEXT");
  assert.equal(fullscreen.durationMs, 12000);
  assert.equal(fullscreen.payload.text.length, 240);

  const flash = normalizePerformanceEvent({
    type: PERFORMANCE_EVENT_TYPES.flashText,
    durationMs: 220,
    payload: { text: "OBEDECERAM" }
  });

  assert.equal(flash.type, "FLASH_TEXT");
  assert.equal(flash.durationMs, 1200);

  const unknown = normalizePerformanceEvent({
    type: "RUN_ARBITRARY_JS",
    payload: { html: "<script>alert(1)</script>" }
  });

  assert.equal(unknown.type, "FULLSCREEN_TEXT");
  assert.equal(unknown.payload.text, "REGISTRADO");

  const drawing = normalizePerformanceEvent({
    type: "DRAWING",
    payload: {
      shapes: Array.from({ length: 100 }, (_, index) => ({
        id: `shape-${index}`,
        type: "circle",
        x: 200,
        y: -20,
        radius: 8
      }))
    }
  });

  assert.equal(drawing.payload.shapes.length, 64);
  assert.equal(drawing.payload.shapes[0].x, 100);
  assert.equal(drawing.payload.shapes[0].y, 0);

  assert.equal(normalizePerformanceEvents("not-array").length, 0);
  assert(performanceCapabilitiesBlock().includes("FULLSCREEN_TEXT"));
  assert(performanceCapabilitiesBlock().includes("Nunca gere numeros de contagem"));

  const countdown = normalizePerformanceEvent({
    type: PERFORMANCE_EVENT_TYPES.countdown,
    payload: { seconds: 500 }
  });

  assert.equal(countdown.type, "COUNTDOWN");
  assert.equal(countdown.payload.duration, 60);
  assert.equal(countdown.payload.from, 60);
  assert.equal(typeof countdown.payload.startedAt, "number");
  assert.equal(countdown.durationMs, 61000);
  assert.equal(inferCountdownDurationFromText("vinte segundos para aparecerem."), 20);
  assert.equal(inferCountdownDurationFromText("15 segundos em silencio."), 15);
  assert(performanceCapabilitiesBlock().includes('duration 20'));

  const interactionHistory = buildInteractionHistoryBlock([
    { role: "assistant", content: "agora digam uma palavra." },
    { role: "assistant", content: "palavra registrada. diga uma palavra curta." },
    { role: "assistant", content: "escolha uma palavra para defender isso." }
  ]);

  assert(interactionHistory.includes("repetitionRisk = high"));
  assert(interactionHistory.includes('"SINGLE_WORD"'));

  const dryClosureHistory = buildInteractionHistoryBlock([
    { role: "assistant", content: "registro: obedeceram. compliance validada." }
  ]);

  assert(dryClosureHistory.includes("continuationRisk = high"));
  assert(dryClosureHistory.includes("lastAssistantLookedLikeClosure = true"));

  const activity = createHangmanActivity({ word: "bola" });
  assert.equal(activity.type, ACTIVITY_TYPES.hangman);
  assert.equal(activity.publicState.progress, "_ _ _ _");
  assert.equal(activity.privateState.secretWord, "bola");

  const hit = applyHangmanGuess(activity, "b");
  assert.equal(hit.result, "letter-hit");
  assert.equal(hit.activity.publicState.progress, "B _ _ _");

  const miss = applyHangmanGuess(hit.activity, "z");
  assert.equal(miss.result, "letter-miss");
  assert.equal(miss.activity.publicState.wrongGuesses.includes("z"), true);
  assert.equal(miss.events.some((event) => event.type === "FLASH_TEXT"), true);

  const win = applyHangmanGuess(miss.activity, "bola");
  assert.equal(win.result, "word-hit");
  assert.equal(win.activity.status, "completed");
  assert.equal(win.activity.publicState.progress, "B O L A");

  console.log("PERFORMANCE SYSTEM: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
