const assert = require("node:assert/strict");

async function main() {
  const director = await import("../lib/suitcases/SuitcaseDirector.js");

  assert.equal(director.interpretSuitcaseContent("tem um papel com um nome escrito").type, "guess_who");
  assert.equal(director.interpretSuitcaseContent("tem escrito insta").type, "instagram");
  assert.equal(director.interpretSuitcaseContent("e um desafio, tipo puzzle").type, "mini_game");
  assert.equal(director.interpretSuitcaseContent("nao entendi o objeto").type, "unknown");

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
  assert.equal(state.guessWho.maxQuestions, 12);
  assert.equal(state.guessWho.maxGuesses, 3);

  let moved = director.applySuitcaseMove(state, {
    action: "ask_question",
    question: "Sou uma pessoa real?"
  });
  state = moved.state;
  assert.equal(state.guessWho.pendingQuestion, "Sou uma pessoa real?");

  advanced = director.advanceSuitcases(state, "sim");
  state = advanced.state;
  assert.equal(state.guessWho.questionCount, 1);
  assert.equal(state.guessWho.knownFacts[0].answer, "sim");

  moved = director.applySuitcaseMove(state, {
    action: "guess",
    guess: "Madonna"
  });
  state = moved.state;
  advanced = director.advanceSuitcases(state, "sim");
  state = advanced.state;
  assert.equal(state.active, false);
  assert.equal(state.result, "machine_win");
  assert(advanced.events.some((event) => event.type === "SHOW_WIN"));

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
