const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const sceneZero = await import("../lib/scene-zero/state.js");
  const collection = await import("../lib/scene-zero/collection.js");
  const browserCommand = await import("../lib/scene-zero/browserCommand.js");
  const gincanaBank = await import("../data/scene-zero-gincanas.js");
  const physicalChallenges = await import("../data/scene-zero-physical-challenges.js");
  const hangmanWords = await import("../data/scene-zero-hangman-words.js");
  const legacySuitcases = await import("../data/archive/scene-zero-suitcases-legacy.js");
  const suitcaseGame = await import("../lib/scene-zero/suitcaseGame.js");
  const emergence = await import("../data/scene-zero-emergence.js");
  const suitcaseHangman = await import("../lib/scene-zero/suitcaseHangman.js");
  const morelBios = await import("../data/scene-zero-morel.js");
  const messageTiming = await import("../lib/messageTiming.js");
  const dataCollectionPrompt = await import("../prompts/dataCollection.js");
  const sceneZeroControllerSource = fs.readFileSync(path.join(process.cwd(), "components", "SceneZeroController.js"), "utf8");
  const sceneZeroProjectionSource = fs.readFileSync(path.join(process.cwd(), "components", "SceneZeroProjectionLayer.js"), "utf8");
  const sceneZeroProjectionStyles = fs.readFileSync(path.join(process.cwd(), "components", "SceneZeroProjectionLayer.module.css"), "utf8");
  const chatSource = fs.readFileSync(path.join(process.cwd(), "components", "Chat.js"), "utf8");
  const sceneZeroRouteSource = fs.readFileSync(path.join(process.cwd(), "app", "api", "scene-zero", "route.js"), "utf8");
  const showStateSource = fs.readFileSync(path.join(process.cwd(), "lib", "showState.js"), "utf8");
  const initial = sceneZero.createInitialSceneZeroState();

  assert.equal(initial.stage, "idle");
  assert.equal(initial.timer.remainingSeconds, 15);
  assert.equal(initial.glitchLevel, "normal");
  assert.equal(initial.suitcaseGame.currentSuitcase, null);
  assert.deepEqual(initial.suitcaseGame.openedSuitcases, []);
  assert.equal(initial.suitcaseGame.suitcaseSelectedAt, null);
  assert.equal(initial.suitcaseGame.suitcaseSelectionSequence, 0);
  assert.equal(initial.suitcaseGame.cuePhase, "idle");
  assert.equal(initial.suitcaseGame.choice.status, "idle");
  assert.equal(initial.suitcaseGame.contentInstruction.status, "idle");
  assert.equal(initial.suitcaseGame.gincana.timer.status, "idle");
  assert.equal(initial.suitcaseGame.gincana.soundtrack.status, "idle");
  assert.equal(initial.suitcaseGame.hangman.status, "idle");
  assert.equal(initial.suitcaseGame.morelBios.status, "idle");
  assert.equal(initial.suitcaseGame.instagram.maxPosts, 10);
  assert.equal(initial.collection.obedience.anticipated, 0);
  assert.equal(initial.participantSelection.continueAt, null);
  assert.equal(initial.participantSelection.continuedAt, null);
  assert.match(sceneZeroControllerSource, /armAudioRelay\(\{ sink: true \}\)/, "o controller da Cena 0 deve ser uma saída de áudio sem depender da aba Sound Control");
  assert.match(sceneZeroControllerSource, /CHAMAR ATENÇÃO/, "o índice lateral deve expor o sinal de atenção");
  assert.match(sceneZeroControllerSource, /TOCAR UBA UBA HEY/, "a Mala 2 deve expor o disparo manual da música no controller");
  assert.match(sceneZeroProjectionSource, /gincanaSoundtrack\?\.status === "playing"/, "a projeção só deve tocar Uba Uba Hey quando o estado manual autorizar");
  assert.match(sceneZeroControllerSource, /<aside[\s\S]*INSTRUÇÃO AVULSA[\s\S]*<\/aside>/, "a instrução avulsa deve ficar no painel fixo da direita");
  assert.doesNotMatch(sceneZeroControllerSource, /suitcaseInstructionBlocked/, "a instrução avulsa deve permanecer acessível durante falas automáticas");
  assert.match(sceneZeroRouteSource, /if \(action === "suitcase-manual-instruction"\) \{\s+const instruction = await publishManualSuitcaseInstruction/, "a API deve publicar a instrução avulsa sem restringir a etapa");
  assert.doesNotMatch(sceneZeroRouteSource, /automaticInstructionActive/, "a instrução avulsa deve poder interromper uma fala automática");
  assert.match(sceneZeroRouteSource, /addMessage\("assistant", text, "scene-zero-suitcase-manual-instruction"\)/, "a instrução avulsa deve usar o canal público normal do bot");
  assert.match(sceneZeroRouteSource, /publishManualSuitcaseInstruction\(body\.instruction, body\.target\)/, "a API deve receber explicitamente o destino da fala avulsa");
  assert.match(sceneZeroRouteSource, /DESTINO SEMÂNTICO: A PRÓPRIA CAIXA PRETA \(campo PARA O BOT\)/, "o campo do bot deve orientar uma fala da Caixa Preta sobre si mesma");
  assert.match(sceneZeroRouteSource, /DESTINO SEMÂNTICO: O PARTICIPANTE OU O PÚBLICO \(campo PARA O PÚBLICO\)/, "o campo do público deve orientar uma fala diretamente ao participante");
  assert.match(sceneZeroControllerSource, /Instrução avulsa para o bot[\s\S]*Instrução avulsa para o participante ou público/, "o controller deve expor campos separados para bot e público");
  assert.match(sceneZeroControllerSource, /sendManualInstruction\("bot"\)[\s\S]*sendManualInstruction\("user"\)/, "cada campo deve enviar seu destino explícito");
  assert.match(showStateSource, /SCENE_ZERO_PARTICIPANT_SELECTED_HOLD_MS = 5000/, "o nome sorteado deve permanecer por cinco segundos no modo automático");
  assert.match(showStateSource, /SCENE_ZERO_PARTICIPANT_COUNTDOWN_MS = 5000/, "a espera anterior à roleta deve durar cinco segundos");
  assert.match(showStateSource, /function completeSceneZeroParticipantInvite[\s\S]*status !== "awaiting_invite"[\s\S]*manualMode[\s\S]*status: "ready_countdown"/, "no manual, o fim da fala deve apenas liberar a próxima seta");
  assert.doesNotMatch(showStateSource, /fallbackDelayMs[\s\S]*beginSceneZeroParticipantCountdown/, "nenhum fallback temporal pode iniciar a contagem antes do typewriter");
  assert.match(showStateSource, /function beginSceneZeroParticipantCountdown[\s\S]*state\.publicMessage = null[\s\S]*status: "countdown"/, "a fala verde deve sair antes de aparecer o timer do sorteio");
  assert.doesNotMatch(sceneZeroProjectionSource, /volunteerCountdown[\s\S]*participantSelection\.invite/, "a contagem não deve repetir o convite em branco");
  assert.match(showStateSource, /const winner = active\.pendingWinner[\s\S]*clearSceneZeroParticipantTimers\(\)[\s\S]*state\.publicMessage = null[\s\S]*status: "selected"/, "a tela do nome deve cancelar falas pendentes e permanecer estática");
  assert.match(showStateSource, /status: postSelection\.length \? "post_selection" : "complete"/, "as falas ao participante devem começar somente depois que a tela do nome sair");
  assert.match(sceneZeroControllerSource, /participantStatus === "ready_countdown"[\s\S]*sceneAction\("participant-countdown-start"/, "a seta direita deve iniciar o timer somente depois da fala completa");
  assert.match(sceneZeroRouteSource, /action === "participant-countdown-start"/, "a API deve aceitar o avanço manual para o timer");
  assert.match(sceneZeroProjectionSource, /centered=\{participantSelection\.status === "countdown"\}/, "o timer do sorteio deve pedir a apresentação central");
  assert.match(sceneZeroProjectionStyles, /\.sceneZeroTimerCentered[\s\S]*top: 50%[\s\S]*left: 50%[\s\S]*translate\(-50%, -50%\)/, "o timer do sorteio deve ocupar o centro da projeção");
  assert.match(sceneZeroProjectionStyles, /\.sceneZeroTimerCentered[^}]*border: 0[^}]*background: transparent[^}]*box-shadow: none/, "o timer pré-sorteio não deve ter quadrado em volta");
  assert.match(sceneZeroProjectionStyles, /\.sceneZeroTimerCentered strong \{ font-size: clamp\(190px, 38vw, 620px\)/, "o número pré-sorteio deve ficar maior");
  assert.match(sceneZeroProjectionStyles, /\.selectionOverlay[^}]*font-family: var\(--bot-font-family/, "a tela de seleção deve usar a mesma fonte configurada para o bot");
  assert.match(chatSource, /<SceneZeroProjectionLayer[\s\S]*botFont=\{robotSound\?\.displayFont \|\| ROBOT_DISPLAY_FONT_DEFAULT\}/, "a projeção da seleção deve receber a fonte ativa do bot");
  assert.match(sceneZeroProjectionSource, /className=\{styles\.selectionOverlay\}[\s\S]*data-bot-font=\{botFont\}/, "o overlay de seleção deve aplicar a fonte ativa do bot");
  assert.match(sceneZeroProjectionStyles, /@keyframes thinkingEllipsis[\s\S]*content: "\."[\s\S]*content: "\.\."[\s\S]*content: "\.\.\."/, "as reticências de /pensando devem crescer até três pontos");
  assert.match(sceneZeroControllerSource, /sceneAction\("participant-continue"/, "a seta direita deve liberar a tela do nome no modo manual");
  assert.match(sceneZeroRouteSource, /action === "participant-continue"/, "a API deve aceitar a continuação manual da seleção");
  assert.match(sceneZeroRouteSource, /inviteWordCount <= 12 && statesFiveSeconds/, "o convite da roleta deve ser curto e declarar os cinco segundos");
  assert.match(sceneZeroRouteSource, /SCENE_ZERO_PARTICIPANT_INVITE = "Agora preciso de participantes\. Levantem a mão\. Vocês têm cinco segundos\."/, "o convite deve pedir participantes antes de mandar levantar a mão");
  assert(!sceneZeroProjectionSource.includes("participantSelection.lastComment || participantSelection.announcement"), "a tela do nome não deve renderizar as falas posteriores sem typewriter");
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
  assert.equal(publicSelectionState.participantSelection.continueAt, null);

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
  assert.match(participantDirection, /Agora preciso de participantes\. Levantem a mão\. Vocês têm cinco segundos\./);
  assert.doesNotMatch(participantDirection, /10 segundos/);

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
  assert.equal(firstTask.id, secondTask.id, "a Mala 2 deve manter o único desafio das bexigas");
  assert.equal(suitcaseGame.chooseGincana([firstTask], [firstTask.id], () => 0).id, firstTask.id);
  assert.equal(suitcaseGame.chooseGincanaDuration({ durationMin: 60, durationMax: 120 }, () => 0), 60);
  assert.equal(suitcaseGame.chooseGincanaDuration({ durationMin: 60, durationMax: 120 }, () => 0.999), 120);
  assert.equal(suitcaseGame.clampGincanaDuration(5), 5);
  assert.equal(suitcaseGame.clampGincanaDuration(30), 30);
  assert.equal(suitcaseGame.clampGincanaDuration(200), 120);
  assert.deepEqual(suitcaseGame.SCENE_ZERO_SUITCASE_ORDER, [2, 3, 1]);
  assert.equal(suitcaseGame.nextSceneZeroSuitcase(initial.suitcaseGame), 2);
  assert.equal(suitcaseGame.nextSceneZeroSuitcase({ currentSuitcase: 2 }), 3);
  assert.equal(suitcaseGame.nextSceneZeroSuitcase({ currentSuitcase: 3 }), 1);
  assert.equal(suitcaseGame.nextSceneZeroSuitcase({ openedSuitcases: [2, 3, 1] }), null);
  assert.equal(suitcaseGame.buildSuitcaseSelectionCue(2), "2");
  assert.equal(suitcaseGame.buildSuitcaseSelectionCue(4), "");
  assert.equal(suitcaseGame.SCENE_ZERO_SUITCASE_CUE_DURATION_MS, 5000);
  assert.deepEqual(suitcaseGame.sceneZeroSuitcaseBriefingSteps(2), [
    {
      id: "game-explanation",
      text: "O jogo é simples: eu indico uma mala. Quando o número aparecer, vá até ela, abra a mala e espere minhas instruções antes de começar. Vou escolher uma mala agora."
    },
    {
      id: "lighting-cue",
      text: 'Ricardinho, dá uma força com a luz aí, pra ficar bem "claro" qual mala abrir. Sim, foi um trocadilho. A verba não cobria um melhor.'
    }
  ]);
  assert.equal(suitcaseGame.sceneZeroSuitcaseBriefingSteps(3)[0].text, "Antes de sortear a segunda mala, resolva o enigma com o jogo da forca.");
  assert.equal(suitcaseGame.sceneZeroSuitcaseBriefingSteps(1)[0].text, "Abra a segunda mala e pegue o disco.");
  assert.equal(suitcaseGame.SCENE_ZERO_FIRST_SUITCASE_INSTRUCTION, "Quando eu autorizar, você vai estourar as bexigas até encontrar a chave. Espere eu dizer ‘VALENDO!’.");
  assert.match(sceneZeroRouteSource, /SUITCASE_INSTRUCTION_READING_HOLD_MS = 2000/, "no automático, cada fala da mala deve manter dois segundos de leitura depois do typewriter");
  assert.match(showStateSource, /action === "suitcase-content-instruction-ready"[\s\S]*status: "ready"/, "a fala intermediária da mala deve ter espera manual explícita");
  assert.match(sceneZeroControllerSource, /suitcaseInstructionWaiting[\s\S]*"suitcase-content-instruction-continue"/, "a seta direita deve liberar a próxima fala da mala");
  assert.equal(suitcaseGame.SCENE_ZERO_LAST_SUITCASE_INSTRUCTION, "Use o disco no toca-discos.");
  assert.doesNotMatch(sceneZeroRouteSource, /instruction\.kind === "last-suitcase"[\s\S]*scheduleTutorialEnd/, "o fim do typewriter não pode concluir o desbloqueio automaticamente");
  assert.match(sceneZeroRouteSource, /finishTutorialAfterTurntableInstruction[\s\S]*instruction\.status !== "complete"/, "o desbloqueio final deve exigir o avanço depois da instrução do toca-discos");
  assert.match(sceneZeroControllerSource, /finalInstructionReady[\s\S]*"suitcase-finish"/, "a seta direita deve concluir o desbloqueio somente quando a instrução final estiver pronta");
  assert.match(sceneZeroControllerSource, /SEGUIR → COMPLETAR DESBLOQUEIO/, "o controller deve expor o avanço manual da etapa do disco");
  assert.equal(suitcaseGame.sceneZeroSuitcaseCueFrameAt(0, 2).phase, "roulette");
  assert.equal(suitcaseGame.sceneZeroSuitcaseCueFrameAt(2200, 2).phase, "reveal");
  assert.equal(suitcaseGame.sceneZeroSuitcaseCueFrameAt(2200, 2).number, 2);
  assert.equal(suitcaseGame.SCENE_ZERO_GINCANA_SUCCESS_INSTRUCTION, "CHAVE ENCONTRADA.");
  assert.equal(suitcaseGame.SCENE_ZERO_GINCANA_FAILURE_INSTRUCTION, "TEMPO ESGOTADO. A CHAVE CONTINUA ESCONDIDA.");
  assert.equal(suitcaseGame.SCENE_ZERO_RETRY_DURATION_SECONDS, 30);
  assert.match(suitcaseGame.sceneZeroRetryComment(suitcaseGame.SCENE_ZERO_GINCANA_RETRY_COMMENTS, 1), /todo mundo espera mais uma vez/i);
  assert.match(suitcaseGame.sceneZeroRetryComment(suitcaseGame.SCENE_ZERO_GINCANA_RETRY_COMMENTS, 1), /substância/i);
  assert.match(suitcaseGame.sceneZeroRetryComment(suitcaseGame.SCENE_ZERO_HANGMAN_RETRY_COMMENTS, 1), /mais 30 segundos/i);
  assert.equal(suitcaseGame.SCENE_ZERO_NEXT_SUITCASE_COMMENTS[3], "Próxima mala. Ricardinho, ilumina o próximo erro.");
  assert.equal(suitcaseGame.SCENE_ZERO_NEXT_SUITCASE_COMMENTS[1], "Vou sortear a próxima mala. Suspense enorme: só sobrou uma. Ricardinho, finge que é surpresa.");
  assert.match(sceneZeroRouteSource, /targetSuitcase\) === 3[\s\S]*startPreDrawHangman/, "a forca deve começar antes do sorteio da segunda mala");
  assert.match(showStateSource, /function publishSceneZeroHangmanResult\(hangman\)[\s\S]*const suitcaseGame = ensureSceneZeroSuitcaseGame\(\)[\s\S]*status: "challenge_result"/, "o resultado da forca deve acessar o estado atual antes de liberar o sorteio");
  assert.match(showStateSource, /status: "challenge_result"[\s\S]*suitcase-choice-predraw-complete/, "a vitória na forca deve liberar o sorteio pendente");
  assert.match(chatSource, /scene-zero-hangman-instruction[\s\S]*scene-zero-hangman-result:success/, "o typewriter deve confirmar tanto a instrução quanto o resultado da forca pré-sorteio");
  assert.match(sceneZeroRouteSource, /queuePreDrawHangmanResultFallback[\s\S]*completePreDrawHangmanResult/, "a conclusão da forca deve ter recuperação caso a confirmação do typewriter se perca");
  assert.match(sceneZeroControllerSource, /preDrawHangmanWaitingToStart[\s\S]*suitcase-predraw-hangman-start/, "o modo manual deve esperar a seta antes de iniciar a forca");
  assert.match(sceneZeroControllerSource, /\["challenge_result", "challenge_complete"\]\.includes\(suitcaseChoice\.status\)[\s\S]*suitcase-predraw-continue/, "o modo manual deve sempre conseguir seguir da vitória da forca para o sorteio");
  assert.match(sceneZeroControllerSource, /emergenceWaiting[\s\S]*suitcase-emergence-continue/, "o lapso entre malas deve ter avanço manual explícito");
  assert.match(sceneZeroControllerSource, /gincanaRetryWaiting[\s\S]*gincana-retry-start[\s\S]*hangmanRetryWaiting[\s\S]*hangman-retry-start/, "as duas repetições devem permanecer avançáveis no modo manual");
  assert.match(sceneZeroControllerSource, /SORTEAR MALA 2[\s\S]*SORTEAR MALA 3[\s\S]*SORTEAR MALA 1/, "o modo manual deve expor um sorteio de recuperação para cada mala");
  assert.match(sceneZeroControllerSource, /suitcaseAdvanceToken[\s\S]*suitcaseAdvanceLockRef[\s\S]*runSuitcaseAdvance/, "a seta deve permanecer travada até o estado da etapa mudar");
  assert.match(sceneZeroRouteSource, /action === "suitcase-manual-draw"[\s\S]*manualSuitcaseDrawInFlight[\s\S]*activateSuitcase\(suitcaseNumber[\s\S]*force: true/, "o sorteio manual deve serializar a recuperação e forçar somente a mala escolhida");
  assert.match(showStateSource, /action === "suitcase-manual-recover"[\s\S]*clearSceneZeroGincanaTimer\(\)[\s\S]*clearSceneZeroHangmanTimer\(\)[\s\S]*openedSuitcases/, "a recuperação deve cancelar a etapa atual sem apagar as malas já realizadas");
  assert.match(showStateSource, /forceSelection[\s\S]*SORTEIO DIRETO EXIGE MODO MANUAL/, "o backend deve recusar sorteio direto fora do modo manual");
  assert.match(sceneZeroProjectionSource, /preDrawHangman[\s\S]*DESAFIO ANTES DA SEGUNDA MALA \/ FORCA/, "a projeção deve apresentar a forca como desafio pré-sorteio");
  assert.equal(suitcaseGame.shouldShowGincanaTimer({ status: "running" }), true);
  assert.equal(suitcaseGame.shouldShowGincanaTimer({ status: "complete" }), true);
  assert.equal(suitcaseGame.shouldShowGincanaTimer({ status: "completed" }), true);
  assert.equal(
    gincanaBank.SCENE_ZERO_GINCANAS.find((task) => task.id === "colecao_improvavel").instruction,
    "Traga exatamente uma chave, uma moeda e uma caneta. Os três objetos devem caber juntos em uma das suas mãos."
  );
  assert.equal(physicalChallenges.SCENE_ZERO_PHYSICAL_CHALLENGES.length, 1);
  for (const challenge of physicalChallenges.SCENE_ZERO_PHYSICAL_CHALLENGES) {
    assert(challenge.id && challenge.text && challenge.target && challenge.duration && challenge.category && challenge.intensity);
    assert(challenge.successMessage && challenge.failureMessage);
    assert.match(challenge.text, /BEXIGAS.*CHAVE/);
    assert.doesNotMatch(challenge.text, /PLATEIA/);
  }
  assert.doesNotMatch(JSON.stringify(physicalChallenges.SCENE_ZERO_PHYSICAL_CHALLENGES), /MORTOS NAS CADEIRAS E NO CHÃO/, "a ação dos mortos não pertence à Mala 2");
  assert.equal(suitcaseGame.SCENE_ZERO_FIRST_CHALLENGE.id, "bexigas-chave");
  assert.equal(suitcaseGame.sceneZeroGincanaDuration(suitcaseGame.SCENE_ZERO_FIRST_CHALLENGE), 15);
  assert.equal(suitcaseGame.buildGincanaPresentation(suitcaseGame.SCENE_ZERO_FIRST_CHALLENGE), "Você terá apenas 15 segundos.");
  assert.doesNotMatch(suitcaseGame.buildGincanaPresentation(suitcaseGame.SCENE_ZERO_FIRST_CHALLENGE), /MORTOS/);
  assert.equal(suitcaseGame.sceneZeroSuitcaseChallenge(1), null);
  assert.equal(suitcaseGame.sceneZeroSuitcaseChallenge(2, [], () => 0).id, "bexigas-chave");
  assert.equal(suitcaseGame.sceneZeroSuitcaseChallenge(2, ["bexigas-chave"], () => 0).id, "bexigas-chave");
  assert.equal(suitcaseGame.sceneZeroSuitcaseChallenge(3), null);
  assert.equal(suitcaseGame.SCENE_ZERO_SUITCASES[1].game, "tutorial_end");
  assert.equal(suitcaseGame.SCENE_ZERO_SUITCASES[2].game, "physical_challenge");
  assert.equal(suitcaseGame.SCENE_ZERO_SUITCASES[3].game, "hangman");
  assert.equal(emergence.sceneZeroEmergenceCueForNextSuitcase(2), null, "a explicação inicial não deve competir com prompt ou glitch");
  assert.deepEqual(
    [3, 1].map((number) => emergence.sceneZeroEmergenceCueForNextSuitcase(number).glitchLevel),
    ["glitch-2", "glitch-3"]
  );
  const finalEmergenceCue = emergence.sceneZeroEmergenceCueForNextSuitcase(1);
  assert.equal(finalEmergenceCue.text, ":)");
  assert.equal(
    emergence.sceneZeroEmergenceCueForMessage({ source: emergence.sceneZeroEmergenceSource(finalEmergenceCue.id) }),
    finalEmergenceCue
  );
  assert(
    emergence.sceneZeroEmergenceEraseDelay(finalEmergenceCue, 18)
      > emergence.sceneZeroEmergenceEraseDelay(finalEmergenceCue, 17),
    "o apagamento deve incluir hesitações determinísticas"
  );
  assert(emergence.sceneZeroEmergenceDurationMs(finalEmergenceCue) > finalEmergenceCue.holdMs);

  assert.deepEqual(legacySuitcases.LEGACY_SCENE_ZERO_SUITCASE_ORDER, [2, 3, 1]);
  assert.equal(legacySuitcases.LEGACY_SCENE_ZERO_SUITCASES[2].game, "gincana");
  assert.equal(legacySuitcases.SCENE_ZERO_EVIDENCIAS_CHALLENGE.id, "evidencias_objeto_microfone");
  assert.equal(legacySuitcases.SCENE_ZERO_SMELL_CHALLENGE.id, "objeto_pelo_cheiro");
  assert.equal(gincanaBank.SCENE_ZERO_EVIDENCIAS_INTRO_SECONDS, 5);
  assert.equal(gincanaBank.SCENE_ZERO_EVIDENCIAS_LYRICS.reduce((total, line) => total + line.durationSeconds, 0), 18);
  assert.equal(gincanaBank.SCENE_ZERO_EVIDENCIAS_PLAYBACK_RATE, 0.96);
  assert.equal(gincanaBank.SCENE_ZERO_EVIDENCIAS_DURATION_SECONDS, 24);
  assert.deepEqual(gincanaBank.SCENE_ZERO_EVIDENCIAS_LYRICS.map((line) => line.durationSeconds), [2, 2, 2, 2, 2, 4, 4]);
  assert.deepEqual(gincanaBank.sceneZeroEvidenciasFrameAt(0), { phase: "intro", activeDots: 1 });
  assert.deepEqual(gincanaBank.sceneZeroEvidenciasFrameAt(4.2), { phase: "intro", activeDots: 5 });
  assert.equal(gincanaBank.sceneZeroEvidenciasFrameAt(5).phase, "intro");
  assert.equal(gincanaBank.sceneZeroEvidenciasFrameAt(5 / 0.96).lineIndex, 0);
  assert.equal(gincanaBank.sceneZeroEvidenciasFrameAt(7 / 0.96).lineIndex, 1);
  assert.equal(gincanaBank.sceneZeroEvidenciasFrameAt(15 / 0.96).lineIndex, 5);
  assert.equal(gincanaBank.sceneZeroEvidenciasFrameAt(19 / 0.96).lineIndex, 6);
  assert.deepEqual(gincanaBank.sceneZeroEvidenciasFrameAt(24), { phase: "complete", lineIndex: 6, lineProgress: 1 });
  assert.equal(fs.existsSync(path.join(process.cwd(), "assets", gincanaBank.SCENE_ZERO_EVIDENCIAS_AUDIO_FILE)), true);
  assert.equal(hangmanWords.SCENE_ZERO_HANGMAN_WORDS.length, 24);
  assert(hangmanWords.SCENE_ZERO_HANGMAN_THEMES.length > 1);
  const themeDraw = suitcaseHangman.startSceneZeroHangmanThemeDraw();
  assert.equal(themeDraw.status, "theme-drawing");
  assert.equal(themeDraw.wordId, null, "a palavra só deve ser escolhida após o sorteio do tema");
  const selectedTheme = suitcaseHangman.chooseSceneZeroHangmanTheme({ random: () => 0 });
  const themedWord = suitcaseHangman.chooseSceneZeroHangmanWord({ theme: selectedTheme, random: () => 0 });
  assert.equal(themedWord.category, selectedTheme);
  const configuredAfterDraw = suitcaseHangman.configureSceneZeroHangman(themeDraw, themedWord.id);
  assert.equal(configuredAfterDraw.themeDraw.status, "selected");
  assert.equal(configuredAfterDraw.theme, selectedTheme);
  assert.equal(suitcaseHangman.cancelSceneZeroHangman(themeDraw).themeDraw.status, "cancelled");
  let hangman = suitcaseHangman.configureSceneZeroHangman(undefined, "hangman-11", { start: true });
  assert.equal(hangman.status, "active");
  assert.equal(hangman.theme, "arquivo");
  assert.equal(hangman.timer.durationSeconds, 60);
  assert.equal(hangman.timer.status, "running");
  assert.equal(hangman.activity.publicState.progress.includes("   "), true, "expressão deve preservar separação entre palavras");
  hangman = suitcaseHangman.guessSceneZeroHangman(hangman, "A");
  assert.match(hangman.activity.publicState.progress, /A/);
  hangman = suitcaseHangman.addSceneZeroHangmanError(hangman);
  hangman = suitcaseHangman.addSceneZeroHangmanError(hangman);
  hangman = suitcaseHangman.addSceneZeroHangmanError(hangman);
  hangman = suitcaseHangman.addSceneZeroHangmanError(hangman);
  assert.equal(hangman.status, "lost");
  assert.equal(Object.hasOwn(hangman, "flightState"), false, "a gravidade da forca deve ser visual, sem rótulo textual de estado");
  assert.equal(hangman.revealedWord, "CAIXA PRETA");
  assert.equal(suitcaseHangman.publicSceneZeroHangman(hangman).theme, "arquivo");
  const restartedHangman = suitcaseHangman.configureSceneZeroHangman(hangman, "hangman-20", { start: true });
  const wonHangman = suitcaseHangman.winSceneZeroHangman(restartedHangman);
  assert.equal(wonHangman.status, "won");
  assert.equal(wonHangman.resultMessage, "REGISTRO RECUPERADO.");
  const timedOutHangman = suitcaseHangman.timeoutSceneZeroHangman(restartedHangman);
  assert.equal(timedOutHangman.status, "lost");
  assert.equal(timedOutHangman.resultMessage, "TEMPO ESGOTADO.");
  assert.equal(timedOutHangman.lastResult, "timeout");
  const retryHangman = suitcaseHangman.prepareSceneZeroHangmanRetry(timedOutHangman);
  assert.equal(retryHangman.status, "retry_wait");
  assert.equal(retryHangman.retry.status, "announcing");
  assert.equal(retryHangman.retry.durationSeconds, 30);
  assert.equal(retryHangman.timer.status, "retry_wait");
  assert.equal(retryHangman.revealedWord, null, "a segunda chance não deve revelar a resposta");
  assert.equal(retryHangman.errorCount, 0);
  const readyRetryHangman = { ...retryHangman, retry: { ...retryHangman.retry, status: "ready" } };
  const runningRetryHangman = suitcaseHangman.restartSceneZeroHangmanRetry(readyRetryHangman);
  assert.equal(runningRetryHangman.status, "active");
  assert.equal(runningRetryHangman.retry.status, "running");
  assert.equal(runningRetryHangman.timer.status, "running");
  assert.equal(runningRetryHangman.timer.durationSeconds, 30);
  assert.equal(morelBios.SCENE_ZERO_MOREL_BIOS_DURATION_MS, 30000);
  assert.match(morelBios.SCENE_ZERO_MOREL_BIOS_LINES.join(" "), /girando, girando/i);
  assert.match(morelBios.SCENE_ZERO_MOREL_BIOS_LINES.join(" "), /nossa vida não é apreciavelmente distinta da sobrevivência/i);
  assert.match(morelBios.SCENE_ZERO_MOREL_BIOS_LINES.join(" "), /STALL/);
  assert.match(morelBios.SCENE_ZERO_MOREL_BIOS_LINES.join(" "), /ouvir c0r3s/i);
  assert.match(morelBios.SCENE_ZERO_MOREL_BIOS_LINES.join(" "), /CALMA, THIAGO/);
  assert.match(morelBios.SCENE_ZERO_MOREL_BIOS_LINES.join(" "), /O QUE ACONTECEU/);
  assert.doesNotMatch(morelBios.SCENE_ZERO_MOREL_BIOS_LINES.join(" "), /Morel|Bioy Casares|A invenção/i);
  assert.equal(suitcaseGame.SCENE_ZERO_INSTAGRAM_TARGETS.robson.participantName, "Robinson Rogério");

  const activeGincana = {
    ...initial,
    stage: "suitcases",
    suitcaseGame: {
      ...initial.suitcaseGame,
      currentSuitcase: 2,
      currentGame: "physical_challenge",
      gincana: {
        ...initial.suitcaseGame.gincana,
        currentTask: suitcaseGame.publicGincanaTask(firstTask),
        durationSeconds: 15,
        timer: { ...initial.suitcaseGame.gincana.timer, status: "running", durationSeconds: 15, remainingSeconds: 15 }
      }
    }
  };
  const gincanaContext = sceneZero.buildSceneZeroContext(activeGincana);
  assert.match(gincanaContext, /Mala.*atual 2/i);
  assert.match(gincanaContext, /tempo 15s/);
  const gincanaDirection = sceneZero.buildSceneZeroDirection(activeGincana, "gincana_complete", "encontrou a chave");
  assert.match(gincanaDirection, /desafio físico terminou com sucesso/);
  assert.match(gincanaDirection, /encontrou a chave/);
  const gincanaPresentation = sceneZero.buildSceneZeroDirection(activeGincana, "gincana_present");
  assert.match(gincanaPresentation, /comando VALENDO/);
  assert.match(gincanaPresentation, /exatamente 15 segundos/);
  assert.match(gincanaPresentation, /Não peça nem mencione objetos da plateia/);

  const legacySnapshot = sceneZero.publicSceneZeroSnapshot({ ...initial, suitcaseGame: undefined });
  assert.equal(legacySnapshot.suitcaseGame.instagram.maxPosts, 10);
  assert.equal(legacySnapshot.suitcaseGame.hangman.status, "idle");
  assert.equal(legacySnapshot.suitcaseGame.morelBios.status, "idle");

  const messageSchedule = messageTiming.sequentialMessageSchedule(["12345", "1234567890"]);
  assert.equal(messageTiming.PUBLIC_TYPE_INTERVAL_MS, 60);
  assert.equal(messageSchedule.offsets[0], 650);
  assert(messageSchedule.offsets[1] >= 650 + (5 * messageTiming.PUBLIC_TYPE_INTERVAL_MS));
  assert(messageSchedule.totalDurationMs > messageSchedule.offsets[1]);

  console.log("scene-zero-test: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
