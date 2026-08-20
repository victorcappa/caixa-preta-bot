const assert = require("node:assert/strict");

async function main() {
  const director = await import("../lib/suitcases/SuitcaseDirector.js");

  assert.equal(director.interpretSuitcaseContent("tem um papel com um nome escrito").type, "guess_who");
  assert.equal(director.interpretSuitcaseContent("achei um nome").type, "guess_who");
  assert.equal(director.interpretSuitcaseContent("tem uma pessoa escrita").type, "guess_who");
  assert.equal(director.interpretSuitcaseContent("tem um papel").type, "needs_person_confirmation");
  assert.equal(director.interpretSuitcaseContent("tem escrito insta").type, "instagram");
  assert.equal(director.interpretSuitcaseContent("e um desafio, tipo puzzle").type, "mini_game");
  assert.equal(director.interpretSuitcaseContent("nao entendi o objeto").type, "unknown");
  assert.equal(director.findInstagramParticipantByName("Janaína Leite")?.instagramHandle, "@janainaleite");
  assert.equal(director.findInstagramParticipantByName("Pessoa inexistente"), null);

  let state = director.createInitialSuitcaseState();
  let started = director.startSuitcases(state, { source: "test" });
  state = started.state;
  assert.equal(state.active, true);
  assert.equal(state.phase, "WAITING_FOR_SUITCASE_SELECTION");
  assert(started.events.some((event) => event.type === "FULLSCREEN_TEXT"));

  let advanced = director.advanceSuitcases(state, "mala 1");
  state = advanced.state;
  assert.equal(state.selectedSuitcase, 1);
  assert.equal(state.phase, "WAITING_FOR_SUITCASE_CONTENT");

  advanced = director.advanceSuitcases(state, "tem um papel escrito Madonna");
  state = advanced.state;
  assert.equal(state.activeExperience, "guess_who");
  assert.equal(state.guessWho.maxQuestions, null);
  assert.equal(state.guessWho.maxGuesses, null);
  assert.equal(director.isGuessWhoClosedQuestion("Essa pessoa esta viva?"), true);
  assert.equal(director.isGuessWhoClosedQuestion("artista, politico, parente famoso, cientista?"), false);
  assert.equal(director.isGuessWhoClosedQuestion("era mais conhecida local ou nacional?"), false);

  const forcedClosedTurn = director.enforceGuessWhoTurn({
    text: "artista, politico, parente famoso, cientista? escolha uma categoria curta.",
    events: [],
    salience: [],
    activity: null,
    game: null,
    suitcase: null
  }, state);
  assert.equal(forcedClosedTurn.suitcase.action, "ask_question");
  assert.equal(director.isGuessWhoClosedQuestion(forcedClosedTurn.text), true);
  assert.equal(forcedClosedTurn.text, "Essa pessoa era real?");
  assert(!/escolha|categoria|local ou nacional|quer que/i.test(forcedClosedTurn.text));

  let moved = director.applySuitcaseMove(state, {
    action: "ask_question",
    question: forcedClosedTurn.text
  });
  state = moved.state;
  assert.equal(state.guessWho.pendingQuestion, "Essa pessoa era real?");

  advanced = director.advanceSuitcases(state, "sim");
  state = advanced.state;
  assert.equal(state.guessWho.questionCount, 1);
  assert.equal(state.guessWho.knownFacts[0].answer, "sim");

  const repeatedQuestionTurn = director.enforceGuessWhoTurn({
    text: "Essa pessoa era real?",
    suitcase: {
      action: "ask_question",
      question: "Essa pessoa era real?"
    }
  }, state);
  assert.equal(repeatedQuestionTurn.text, "Essa pessoa ainda esta viva?");

  moved = director.applySuitcaseMove(state, {
    action: "ask_question",
    question: "Essa pessoa ficou famosa principalmente em entretenimento e midia?"
  });
  state = moved.state;
  advanced = director.advanceSuitcases(state, "sim");
  state = advanced.state;

  const televisionAxisTurn = director.enforceGuessWhoTurn({
    text: "qual area das artes exatamente?",
    suitcase: null
  }, state);
  assert.equal(televisionAxisTurn.text, "Essa pessoa ainda esta viva?");

  moved = director.applySuitcaseMove(state, {
    action: "ask_question",
    question: televisionAxisTurn.text
  });
  state = moved.state;
  advanced = director.advanceSuitcases(state, "nao sei");
  state = advanced.state;

  const nextTelevisionAxisTurn = director.enforceGuessWhoTurn({
    text: "me diga uma area especifica.",
    suitcase: null
  }, state);
  assert.equal(nextTelevisionAxisTurn.text, "Essa pessoa construiu a carreira principalmente no Brasil?");

  moved = director.applySuitcaseMove(state, {
    action: "ask_question",
    question: nextTelevisionAxisTurn.text
  });
  state = moved.state;
  advanced = director.advanceSuitcases(state, "sim");
  state = advanced.state;

  const centuryTurn = director.enforceGuessWhoTurn({
    text: "qual area especifica?",
    suitcase: null
  }, state);
  assert.equal(centuryTurn.text, "Essa pessoa ficou famosa principalmente no seculo XX?");

  moved = director.applySuitcaseMove(state, {
    action: "ask_question",
    question: centuryTurn.text
  });
  state = moved.state;
  advanced = director.advanceSuitcases(state, "sim");
  state = advanced.state;

  const tvTurn = director.enforceGuessWhoTurn({
    text: "era teatro, cinema, musica ou artes visuais?",
    suitcase: null
  }, state);
  assert.equal(tvTurn.text, "O principal meio dessa pessoa era a televisao?");

  moved = director.applySuitcaseMove(state, {
    action: "guess",
    guess: "Madonna"
  });
  state = moved.state;
  advanced = director.advanceSuitcases(state, "nao");
  state = advanced.state;
  assert.equal(state.active, true);
  assert.equal(state.phase, "ACTIVE_EXPERIENCE");
  assert.equal(state.result, null);
  assert.equal(state.guessWho.finished, false);
  assert(state.guessWho.rejectedHypotheses.includes("Madonna"));
  assert.equal(advanced.result.exhausted, false);

  const afterMissTurn = director.enforceGuessWhoTurn({
    text: "quer escolher outra mala?",
    suitcase: null
  }, state);
  assert.equal(afterMissTurn.suitcase.action, "ask_question");
  assert(!/mala|quer|continuar|escolher/i.test(afterMissTurn.text));

  moved = director.applySuitcaseMove(state, {
    action: "guess",
    guess: "Cher"
  });
  state = moved.state;
  advanced = director.advanceSuitcases(state, "sim, e Cher");
  state = advanced.state;
  assert.equal(state.active, false);
  assert.equal(state.result, "machine_win");
  assert(advanced.events.some((event) => event.type === "SHOW_WIN"));

  state = director.startSuitcases(director.createInitialSuitcaseState(), { source: "test" }).state;
  state = director.advanceSuitcases(state, "mala 1").state;
  advanced = director.advanceSuitcases(state, "tem um papel");
  state = advanced.state;
  assert.equal(state.phase, "WAITING_FOR_SUITCASE_CONTENT");
  assert.equal(state.lastInterpretation.reason, "paper_needs_person_confirmation");
  advanced = director.advanceSuitcases(state, "sim");
  state = advanced.state;
  assert.equal(state.activeExperience, "guess_who");
  assert.equal(state.guessWho.active, true);

  moved = director.applySuitcaseMove(state, {
    action: "ask_question",
    question: "Essa pessoa era real?"
  });
  state = moved.state;
  advanced = director.advanceSuitcases(state, "a resposta e Madonna");
  assert.equal(advanced.state.active, false);
  assert.equal(advanced.state.result, "audience_win");
  assert.equal(advanced.state.guessWho.revealedAnswer, "Madonna");

  state = director.startSuitcases(director.createInitialSuitcaseState(), { source: "test" }).state;
  state = director.advanceSuitcases(state, "2").state;
  advanced = director.advanceSuitcases(state, "instagram");
  state = advanced.state;
  assert.equal(state.activeExperience, "instagram");
  assert.equal(state.instagram.duration, 60);
  assert(advanced.events.some((event) => event.type === "SHOW_INSTAGRAM"));
  assert(advanced.events.some((event) => event.type === "COUNTDOWN"));

  const finishedInstagram = director.finishInstagramTimer(state);
  assert.equal(finishedInstagram.state.active, false);
  assert.equal(finishedInstagram.state.result, "instagram_timeout");

  state = director.startSuitcases(director.createInitialSuitcaseState(), { source: "test" }).state;
  state = director.advanceSuitcases(state, "3").state;
  advanced = director.advanceSuitcases(state, "tem um jogo");
  state = advanced.state;
  assert.equal(state.activeExperience, "mini_game");
  assert(state.currentGame.id);

  const forcedHangman = director.forceSuitcaseExperience(state, "game", {
    source: "test",
    requestedGame: "hangman"
  });
  state = forcedHangman.state;
  assert.equal(state.currentGame.id, "hangman");
  const word = state.currentGame.privateState.word;
  advanced = director.advanceSuitcases(state, word);
  assert.equal(advanced.state.result, "audience_win");
  assert(advanced.events.some((event) => event.type === "SHOW_LOSE"));

  const aborted = director.abortSuitcases(state, { source: "test" });
  assert.equal(aborted.state.active, false);
  assert.equal(aborted.state.phase, "ABORTED");

  console.log("SUITCASE DIRECTOR: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
