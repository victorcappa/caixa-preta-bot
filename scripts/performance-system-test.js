const assert = require("node:assert/strict");

async function main() {
  const eventsModule = await import("../lib/performanceEvents.js");
  const activitiesModule = await import("../lib/activities.js");
  const countdownTextModule = await import("../lib/countdownText.js");
  const interactionModule = await import("../lib/interactionHistory.js");
  const publicTextModule = await import("../lib/publicText.js");

  const {
    PERFORMANCE_EVENT_TYPES,
    filterAgentPerformanceEvents,
    inferActionCountdownEvent,
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
    sanitizePublicTextForProjection
  } = publicTextModule;
  const {
    inferCountdownDurationFromText,
    inferCountdownDurationsFromText
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
  assert(performanceCapabilitiesBlock().includes("so e aceito se o texto publico contiver duracao"));
  assert(performanceCapabilitiesBlock().includes("PHONE_PROJECTION_REQUEST"));
  assert.equal(
    filterAgentPerformanceEvents([{ type: "COUNTDOWN", payload: { duration: 5 } }], "vamos seguir").length,
    0
  );
  assert.equal(
    filterAgentPerformanceEvents([{ type: "COUNTDOWN", payload: { duration: 10 } }], "dez segundos de silencio").length,
    1
  );

  const phoneRequest = normalizePerformanceEvent({
    type: "PHONE_PROJECTION_REQUEST",
    payload: {
      participant: "Victor",
      contentType: "instagram_search",
      privacyLevel: "high",
      requiresHumanApproval: false
    }
  });

  assert.equal(phoneRequest.type, "PHONE_PROJECTION_REQUEST");
  assert.equal(phoneRequest.payload.requiresHumanApproval, true);
  assert.equal(phoneRequest.payload.status, "pending_operator_confirmation");
  assert.equal(phoneRequest.payload.privacyLevel, "high");

  const phoneHide = normalizePerformanceEvent({
    type: "HIDE_PHONE_PROJECTION",
    payload: { text: "private" }
  });

  assert.equal(phoneHide.type, "HIDE_PHONE_PROJECTION");
  assert.deepEqual(phoneHide.payload, {});

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
  assert.deepEqual(inferCountdownDurationsFromText("trinta segundos, depois vinte segundos"), [30, 20]);
  assert.equal(inferCountdownDurationFromText("trinta segundos, depois vinte segundos"), 20);
  assert.equal(
    filterAgentPerformanceEvents([{ type: "COUNTDOWN", payload: { duration: 20 } }], "trinta segundos, depois vinte segundos").length,
    1
  );
  assert.equal(inferCountdownDurationFromText("vinte segundos. nao, dez segundos."), 10);
  assert(performanceCapabilitiesBlock().includes('duration 20'));
  assert(performanceCapabilitiesBlock().includes("ultima e a que vale"));
  const inferredCountdown = inferActionCountdownEvent("Janaina, segure a mao dele por dez segundos.");
  assert.equal(inferredCountdown.type, "COUNTDOWN");
  assert.equal(inferredCountdown.payload.duration, 10);
  assert.equal(
    inferActionCountdownEvent("defenda esse atraso por dez segundos sem culpar o transito").payload.duration,
    10
  );
  assert.equal(inferActionCountdownEvent("eu avisei ha oito segundos."), null);

  const leakedSuitcaseQuestion = sanitizePublicTextForProjection(
    "nao. ok. nomeado e morto - otimo material. vou fazer pergunta formal (ask_question). essa pessoa era conhecida publicamente (sim/nao)?"
  );
  assert.equal(
    leakedSuitcaseQuestion,
    "nao. ok. nomeado e morto - otimo material. essa pessoa era conhecida publicamente (sim/nao)?"
  );
  assert(!/ask_question|suitcase|campo estruturado|JSON|pergunta formal/i.test(leakedSuitcaseQuestion));

  const leakedSuitcaseAction = sanitizePublicTextForProjection(
    "entendido. vou registrar como pergunta (suitcase.action ask_question). proxima: essa pessoa era relacionada a aviacao ou acidentes (sim/nao)?"
  );
  assert.equal(
    leakedSuitcaseAction,
    "proxima: essa pessoa era relacionada a aviacao ou acidentes (sim/nao)?"
  );
  assert(!/ask_question|suitcase|campo estruturado|JSON|vou registrar/i.test(leakedSuitcaseAction));

  const interactionHistory = buildInteractionHistoryBlock([
    { role: "assistant", content: "agora digam uma palavra." },
    { role: "assistant", content: "palavra registrada. diga uma palavra curta." },
    { role: "assistant", content: "escolha uma palavra para defender isso." }
  ]);

  assert(interactionHistory.includes("repetitionRisk = high"));
  assert(interactionHistory.includes('"SINGLE_WORD"'));
  assert(interactionHistory.includes("shortCollectionPressure = high"));

  const mixedCollectionHistory = buildInteractionHistoryBlock([
    { role: "assistant", content: "Lara, aceita o cargo? responda aceito ou substitui." },
    { role: "assistant", content: "Wagner, escolha: consome, paga ou esvazia." }
  ]);

  assert(mixedCollectionHistory.includes("shortCollectionPressure = high"));
  assert(mixedCollectionHistory.includes("nao peca palavra, nome, opcao curta"));

  const presenceLoopHistory = buildInteractionHistoryBlock([
    { role: "assistant", content: "defenda em dez segundos o motivo de estar aqui." },
    { role: "assistant", content: "agora diga por que voce veio ao teatro." }
  ]);

  assert(presenceLoopHistory.includes("presenceJustificationPressure = high"));
  assert(presenceLoopHistory.includes("nao pergunte por que vieram"));
  assert(presenceLoopHistory.includes("Mude de eixo agora"));

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
  assert.equal(hit.events.some((event) => event.type === "FULLSCREEN_TEXT"), false);

  const miss = applyHangmanGuess(hit.activity, "z");
  assert.equal(miss.result, "letter-miss");
  assert.equal(miss.activity.publicState.wrongGuesses.includes("z"), true);
  assert.equal(miss.events.length, 1);
  assert.equal(miss.events[0].type, "FLASH_TEXT");

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
