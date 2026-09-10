const assert = require("node:assert/strict");

async function main() {
  const sceneZero = await import("../lib/scene-zero/state.js");
  const collection = await import("../lib/scene-zero/collection.js");
  const browserCommand = await import("../lib/scene-zero/browserCommand.js");
  const gincanaBank = await import("../data/scene-zero-gincanas.js");
  const suitcaseGame = await import("../lib/scene-zero/suitcaseGame.js");
  const messageTiming = await import("../lib/messageTiming.js");
  const dataCollectionPrompt = await import("../prompts/dataCollection.js");
  const initial = sceneZero.createInitialSceneZeroState();

  assert.equal(initial.stage, "idle");
  assert.equal(initial.timer.remainingSeconds, 15);
  assert.equal(initial.glitchLevel, "normal");
  assert.equal(initial.suitcaseGame.currentSuitcase, null);
  assert.deepEqual(initial.suitcaseGame.openedSuitcases, []);
  assert.equal(initial.suitcaseGame.suitcaseSelectedAt, null);
  assert.equal(initial.suitcaseGame.suitcaseSelectionSequence, 0);
  assert.equal(initial.suitcaseGame.gincana.timer.status, "idle");
  assert.equal(initial.suitcaseGame.instagram.maxPosts, 10);
  assert.equal(initial.collection.obedience.anticipated, 0);
  assert.equal(initial.personalityGuidance.text, "");
  assert.deepEqual(initial.personalityGuidance.quickDirections, []);
  assert(initial.sessionStartedAt);
  assert.equal(sceneZero.normalizeSceneZeroStage("airport"), "airport");
  assert.equal(sceneZero.normalizeSceneZeroStage("automatic-timeline"), null);

  const collectionSystemPrompt = dataCollectionPrompt.buildDataCollectionSystemPrompt();
  assert.match(collectionSystemPrompt, /configuracao e repertorio, nao roteiro/i);
  assert.match(collectionSystemPrompt, /DADO A \+ DADO B \+ DADO C/);
  assert.match(collectionSystemPrompt, /nao possui visao computacional implicita/i);
  assert.match(collectionSystemPrompt, /caixa_preta_coleta_dados/);
  assert.match(collectionSystemPrompt, /dynamic_generation_rules/);
  assert.equal(dataCollectionPrompt.getDataCollectionConfig().version, "2.0");

  const combinedBrowserPlan = browserCommand.fallbackSceneZeroBrowserPlan(
    "Entre no Google e busque inteligência artificial e comente. Ao mesmo tempo, abra uma aba do Instagram e busque o perfil do Nikolas Ferreira."
  );
  assert.equal(combinedBrowserPlan.google.enabled, true);
  assert.equal(combinedBrowserPlan.instagram.enabled, true);
  assert.equal(combinedBrowserPlan.instagram.person, "Nikolas Ferreira");
  const directInstagramPlan = browserCommand.fallbackSceneZeroBrowserPlan(
    "entrar no perfil do @rogerio.robinson no instagram"
  );
  assert.equal(directInstagramPlan.google.enabled, false);
  assert.equal(directInstagramPlan.instagram.enabled, true);
  assert.equal(directInstagramPlan.instagram.person, "@rogerio.robinson");
  assert.equal(
    browserCommand.extractExplicitInstagramHandle("abra o perfil de @Rogerio.Robinson, por favor"),
    "@rogerio.robinson"
  );
  const newGoogleWindowPlan = browserCommand.fallbackSceneZeroBrowserPlan("Abra uma nova janela do Google e pesquise teatro em São Paulo");
  assert.equal(newGoogleWindowPlan.google.enabled, true);
  assert.equal(newGoogleWindowPlan.google.newWindow, true);
  assert.deepEqual(browserCommand.preserveExplicitNewsIntent({
    query: "eleições de 2026",
    preferNews: false,
    openResult: true,
    resultCount: 1
  }, "busque notícias sobre eleições de 2026"), {
    query: "eleições de 2026",
    preferNews: true,
    openResult: true,
    resultCount: 2
  });
  assert.equal(browserCommand.normalizeSceneZeroBrowserPlan({
    google: { enabled: false },
    instagram: { enabled: true, person: "  @cappavictor  " }
  }, "abra o instagram").instagram.person, "@cappavictor");
  assert.deepEqual(browserCommand.normalizeSceneZeroBrowserPlan({
    google: { enabled: true, guidance: "pesquisar o que significa arroba" },
    instagram: { enabled: false, person: "" }
  }, "entrar no perfil do @rogerio.robinson no instagram"), {
    command: "entrar no perfil do @rogerio.robinson no instagram",
    google: { enabled: false, guidance: "", newWindow: false },
    instagram: { enabled: true, person: "@rogerio.robinson" }
  });

  const people = [
    { key: "marcus garcia", name: "Marcus Garcia", selectedCount: 0 },
    { key: "victor cappa", name: "Victor Cappa", selectedCount: 0 },
    { key: "janaina leite", name: "Janaína Leite", selectedCount: 1 },
    { key: "lara duarte", name: "Lara Duarte", selectedCount: 0 }
  ];
  const first = sceneZero.chooseSceneZeroParticipant(people, null, () => 0);
  assert.equal(first.name, "Lara Duarte");
  const another = sceneZero.chooseSceneZeroParticipant(people, first, () => 0);
  assert.equal(another.name, "Janaína Leite");
  assert.notEqual(another.name, "Marcus Garcia");
  assert.notEqual(another.name, "Victor Cappa");
  assert.deepEqual(
    sceneZero.eligibleSceneZeroParticipants(people).map((participant) => participant.name),
    ["Janaína Leite", "Lara Duarte"]
  );

  const privateSelectionState = {
    ...initial,
    participantSelection: {
      ...initial.participantSelection,
      status: "roulette",
      candidates: people,
      pendingWinner: people[3],
      preparedComments: ["interno"],
      preparedAnnouncement: "interno"
    }
  };
  const publicSelectionState = sceneZero.publicSceneZeroSnapshot(privateSelectionState);
  assert.equal(publicSelectionState.participantSelection.pendingWinner, undefined);
  assert.equal(publicSelectionState.participantSelection.preparedComments, undefined);
  assert.equal(publicSelectionState.participantSelection.candidates.length, 4);

  const active = {
    ...initial,
    stage: "collection",
    previousStage: "idle",
    collection: {
      ...initial.collection,
      questions: [{ text: "Pergunta inventada pelo modelo?" }]
    }
  };
  const direction = sceneZero.buildSceneZeroDirection(active, "collection_new_question");
  assert.match(direction, /DATASET DA SALA/);
  assert.match(direction, /intervenção inédita/);
  assert.match(direction, /sessão em curso há aproximadamente/);
  assert(!direction.includes("Bata três palmas quem veio de transporte público"));

  const continuationDirection = sceneZero.buildSceneZeroDirection(active, "collection_result_continue");
  assert.match(continuationDirection, /Reaja brevemente a esse dado específico/);
  assert.match(continuationDirection, /continue a coleta com uma única nova intervenção clara/);
  assert.match(continuationDirection, /não invente quantidade ou comportamento ausente/);

  const parsedCollection = collection.parseCollectionIntervention(JSON.stringify({
    fala: "Quem usa metrô levante a mão e mantenha por 12 segundos.",
    question: {
      topic: "sao_paulo",
      action: "KEEP_HAND_RAISED",
      expectedAnswerType: "binary",
      intensity: 2,
      sensitivity: "low",
      locationContext: "Metrô de São Paulo",
      scope: "room",
      conditions: ["usa metrô"],
      waitSeconds: 30
    }
  }));
  assert.equal(parsedCollection.data.action, "KEEP_HAND_RAISED");
  assert.equal(parsedCollection.data.waitSeconds, 12);
  assert.equal(parsedCollection.data.result, null);
  assert.match(collection.collectionRepertoireBlock(), /CHANGE_SEAT só pode ser escolhido/);
  assert.match(collection.collectionRepertoireBlock(), /Cruze respostas anteriores/);
  assert(collection.COLLECTION_ACTIONS.includes("CLAP_PATTERN"));
  assert(collection.COLLECTION_ACTIONS.includes("SAY_ALOUD"));
  const recentHandQuestion = [{ action: "RAISE_HAND", text: "Levante a mão." }];
  const variedRepertoire = collection.collectionRepertoireBlock(recentHandQuestion);
  assert.match(variedRepertoire, /PROIBIDO NESTA INTERVENÇÃO/);
  assert.match(variedRepertoire, /número exato de palmas, como três/);
  assert.equal(collection.shouldRejectRepeatedHandAction({
    text: "Quem concorda levante a mão.",
    data: { action: "RAISE_HAND" }
  }, recentHandQuestion), true);
  assert.equal(collection.shouldRejectRepeatedHandAction({
    text: "Quem concorda bata três palmas.",
    data: { action: "CLAP_COUNT" }
  }, recentHandQuestion), false);
  assert.equal(collection.shouldRejectRepeatedHandAction({
    text: "Mantenham as mãos no alto.",
    data: { action: "VERBAL" }
  }, recentHandQuestion), true);
  assert.equal(collection.shouldRejectRepeatedHandAction({
    text: "Podem abaixar as mãos.",
    data: { action: "LOWER_HAND" }
  }, recentHandQuestion), false);

  const participantDirection = sceneZero.buildSceneZeroDirection(
    { ...initial, stage: "participant" },
    "participant_roulette_sequence"
  );
  assert.match(participantDirection, /10 segundos/);
  assert.match(participantDirection, /sarcástico, informal e Gen Z/);

  const normalMessageContext = sceneZero.buildSceneZeroContext({ ...initial, stage: "participant" });
  assert.match(normalMessageContext, /uma fala da Caixa Preta deve terminar completamente/);
  const guidedContext = sceneZero.buildSceneZeroContext({
    ...initial,
    stage: "participant",
    personalityGuidance: { text: "mais impaciente e seca", updatedAt: new Date().toISOString() }
  });
  assert.match(guidedContext, /mais impaciente e seca/);
  assert.match(guidedContext, /não mandam interromper/);
  const idleGuidanceContext = sceneZero.buildSceneZeroContext({
    ...initial,
    personalityGuidance: { text: "mais curiosa", updatedAt: new Date().toISOString() }
  });
  assert.match(idleGuidanceContext, /mais curiosa/);
  assert.doesNotMatch(idleGuidanceContext, /ESTADO DRAMATÚRGICO ATIVO/);
  const quickGuidanceContext = sceneZero.buildSceneZeroContext({
    ...initial,
    personalityGuidance: { text: "", quickDirections: ["short", "acid", "fewer_questions"], updatedAt: new Date().toISOString() }
  });
  assert.match(quickGuidanceContext, /MAIS CURTA/);
  assert.match(quickGuidanceContext, /MAIS ÁCIDA/);
  assert.match(quickGuidanceContext, /MENOS PERGUNTAS/);
  assert.deepEqual(sceneZero.normalizeSceneZeroPersonalityDirections(["short", "invalid", "short", "curious"]), ["short", "curious"]);
  assert.deepEqual(sceneZero.normalizeSceneZeroPersonalityDirections(["short", "acid", "developed"]), ["acid", "developed"]);
  const anytimeQuestion = sceneZero.buildSceneZeroDirection({ ...initial, stage: "cake" }, "question_anytime");
  assert.match(anytimeQuestion, /sem mudar, encerrar ou avançar/);
  const glitchMessageContext = sceneZero.buildSceneZeroContext({ ...initial, stage: "glitch", glitchLevel: "glitch-2" });
  assert.match(glitchMessageContext, /podem coexistir várias falas/);
  assert.match(glitchMessageContext, /conversando entre si/);
  assert.equal(sceneZero.sceneZeroGlitchCommand("glitch-1").action, "trigger");
  assert.equal(sceneZero.sceneZeroGlitchCommand("glitch-4").action, "trigger");
  assert.equal(sceneZero.sceneZeroGlitchCommand("glitch-4").payload.durationMs, 1800);
  assert.equal(sceneZero.sceneZeroGlitchCommand("collapse").action, "continuous");
  assert.match(sceneZero.sceneZeroGlitchLanguageDirection("glitch-1"), /pequena estranheza/);
  assert.match(sceneZero.sceneZeroGlitchLanguageDirection("glitch-4"), /nomes ou fragmentos/);
  assert.match(sceneZero.sceneZeroGlitchLanguageDirection("collapse"), /nunca gere caracteres aleatórios/);

  const firstTask = suitcaseGame.chooseGincana(undefined, [], () => 0);
  const secondTask = suitcaseGame.chooseGincana(undefined, [firstTask.id], () => 0);
  assert.notEqual(firstTask.id, secondTask.id);
  assert.equal(suitcaseGame.chooseGincana([firstTask], [firstTask.id], () => 0), null);
  assert.equal(suitcaseGame.chooseGincanaDuration({ durationMin: 60, durationMax: 120 }, () => 0), 60);
  assert.equal(suitcaseGame.chooseGincanaDuration({ durationMin: 60, durationMax: 120 }, () => 0.999), 120);
  assert.equal(suitcaseGame.clampGincanaDuration(5), 60);
  assert.equal(suitcaseGame.clampGincanaDuration(30), 60);
  assert.equal(suitcaseGame.clampGincanaDuration(200), 120);
  assert.deepEqual(suitcaseGame.SCENE_ZERO_SUITCASE_ORDER, [2, 3, 1]);
  assert.equal(suitcaseGame.nextSceneZeroSuitcase(initial.suitcaseGame), 2);
  assert.equal(suitcaseGame.nextSceneZeroSuitcase({ currentSuitcase: 2 }), 3);
  assert.equal(suitcaseGame.nextSceneZeroSuitcase({ currentSuitcase: 3 }), 1);
  assert.equal(suitcaseGame.nextSceneZeroSuitcase({ openedSuitcases: [2, 3, 1] }), null);
  assert.equal(suitcaseGame.buildSuitcaseSelectionCue(2), "Vá até a mala indicada: 2. A luz vai indicar.");
  assert.equal(suitcaseGame.buildSuitcaseSelectionCue(4), "");
  assert.equal(suitcaseGame.SCENE_ZERO_SUITCASE_CUE_DURATION_MS, 10000);
  assert.equal(suitcaseGame.shouldShowGincanaTimer({ status: "running" }), true);
  assert.equal(suitcaseGame.shouldShowGincanaTimer({ status: "complete" }), true);
  assert.equal(suitcaseGame.shouldShowGincanaTimer({ status: "completed" }), true);
  assert.equal(
    gincanaBank.SCENE_ZERO_GINCANAS.find((task) => task.id === "colecao_improvavel").instruction,
    "Traga exatamente uma chave, uma moeda e uma caneta. Os três objetos devem caber juntos em uma das suas mãos."
  );
  assert.equal(
    suitcaseGame.buildGincanaPresentation(
      gincanaBank.SCENE_ZERO_GINCANAS.find((task) => task.id === "colecao_improvavel"),
      105
    ),
    "Gincana. Você tem 105 segundos. Traga exatamente uma chave, uma moeda e uma caneta. Os três objetos devem caber juntos em uma das suas mãos. Começar."
  );
  assert.equal(suitcaseGame.SCENE_ZERO_FIRST_CHALLENGE.id, "evidencias_lanterna");
  assert.equal(suitcaseGame.chooseGincanaDuration(suitcaseGame.SCENE_ZERO_FIRST_CHALLENGE), 20);
  assert.match(suitcaseGame.buildGincanaPresentation(suitcaseGame.SCENE_ZERO_FIRST_CHALLENGE, 20), /lanterna como microfone/);
  assert.match(suitcaseGame.buildGincanaPresentation(suitcaseGame.SCENE_ZERO_FIRST_CHALLENGE, 20), /Evidências/);
  assert.match(suitcaseGame.buildGincanaPresentation(suitcaseGame.SCENE_ZERO_FIRST_CHALLENGE, 20), /20 segundos/);
  assert.match(suitcaseGame.buildGincanaPresentation(suitcaseGame.SCENE_ZERO_FIRST_CHALLENGE, 20), /público pode ajudar/i);
  assert.equal(suitcaseGame.SCENE_ZERO_INSTAGRAM_TARGETS.robson.participantName, "Robinson Rogério");

  const activeGincana = {
    ...initial,
    stage: "suitcases",
    suitcaseGame: {
      ...initial.suitcaseGame,
      currentSuitcase: 2,
      currentGame: "gincana",
      gincana: {
        ...initial.suitcaseGame.gincana,
        currentTask: suitcaseGame.publicGincanaTask(firstTask),
        durationSeconds: 90,
        timer: { ...initial.suitcaseGame.gincana.timer, status: "running", durationSeconds: 90, remainingSeconds: 90 }
      }
    }
  };
  const gincanaContext = sceneZero.buildSceneZeroContext(activeGincana);
  assert.match(gincanaContext, /Mala.*atual 2/i);
  assert.match(gincanaContext, /tempo 90s/);
  const gincanaDirection = sceneZero.buildSceneZeroDirection(activeGincana, "gincana_complete", "trouxe três objetos");
  assert.match(gincanaDirection, /comentário sobre o resultado real/);
  assert.match(gincanaDirection, /comentário curto e sarcástico sobre as habilidades de canto/);
  assert.match(gincanaDirection, /trouxe três objetos/);
  const gincanaPresentation = sceneZero.buildSceneZeroDirection(activeGincana, "gincana_present");
  assert.match(gincanaPresentation, /ordem fechada/);
  assert.match(gincanaPresentation, /não ofereça alternativas/);

  const legacySnapshot = sceneZero.publicSceneZeroSnapshot({ ...initial, suitcaseGame: undefined });
  assert.equal(legacySnapshot.suitcaseGame.instagram.maxPosts, 10);

  const messageSchedule = messageTiming.sequentialMessageSchedule(["12345", "1234567890"]);
  assert.equal(messageSchedule.offsets[0], 650);
  assert(messageSchedule.offsets[1] >= 650 + (5 * messageTiming.PUBLIC_TYPE_INTERVAL_MS));
  assert(messageSchedule.totalDurationMs > messageSchedule.offsets[1]);

  console.log("scene-zero-test: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
