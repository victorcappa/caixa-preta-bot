const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const publicoPath = path.join(__dirname, "..", "data", "publico.json");
const originalPublico = fs.readFileSync(publicoPath, "utf8");

function baseState(patch = {}) {
  return {
    memories: [],
    conversation: [],
    mode: "host",
    game: null,
    participants: {
      session: [],
      history: {}
    },
    ...patch
  };
}

async function main() {
  const director = await import("../lib/host/GameDirector.js");
  const participants = await import("../lib/participants.js");

  const emptyPublic = JSON.stringify([
    {
      name: "equipe",
      nomes: ["Janaína Leite", "Marcus Garcia", "Robinson Rogério", "Isabella Miranda"]
    },
    {
      name: "publico",
      nomes: []
    }
  ], null, 2);

  fs.writeFileSync(publicoPath, `${emptyPublic}\n`);
  let state = baseState({ game: director.createInitialGameState() });

  const emptyPool = participants.getParticipantPool(state.participants);
  assert.equal(emptyPool.counts.audience, 0);
  assert.equal(emptyPool.counts.team, 4);
  assert.deepEqual(
    participants.inferSessionParticipantsFromMemory("Janaína leite está no recinto"),
    ["Janaína Leite"]
  );
  assert.deepEqual(
    participants.inferSessionParticipantsFromMemory("Ana chegou atrasada"),
    ["Ana"]
  );
  assert.deepEqual(participants.saveAudienceParticipants(["Ana", "Janaína Leite"]), ["Ana"]);
  assert(JSON.parse(fs.readFileSync(publicoPath, "utf8"))[1].nomes.includes("Ana"));
  fs.writeFileSync(publicoPath, `${emptyPublic}\n`);

  let started = director.startGame(state, { source: "operator" });
  assert.equal(started.gameState.active, true);
  assert(started.gameState.participants.length >= 1);
  assert(started.gameState.participants.some((participant) => participant.source === "team"));

  const withAudience = JSON.stringify([
    {
      name: "equipe",
      nomes: ["Janaína Leite", "Marcus Garcia", "Robinson Rogério", "Isabella Miranda"]
    },
    {
      name: "publico",
      nomes: ["Ana", "Carlos", "Beatriz"]
    }
  ], null, 2);

  fs.writeFileSync(publicoPath, `${withAudience}\n`);
  state = baseState({ game: director.createInitialGameState() });
  const audiencePool = participants.getParticipantPool(state.participants);
  assert.equal(audiencePool.counts.audience, 3);

  started = director.startGame(state, { requestedGame: "teams", source: "operator" });
  assert.equal(started.gameState.id, "team_battle");
  assert.equal(started.gameState.teams.length, 2);
  assert(started.gameState.participants.some((participant) => participant.source === "audience"));
  assert(started.gameState.participants.some((participant) => participant.source === "team"));

  const rankedGames = director.scoreGames(state).slice(0, 15).map((item) => item.game.id);
  assert(rankedGames.includes("hangman"));
  assert(rankedGames.includes("who_am_i"));
  assert(rankedGames.includes("cards_style_fill_in"));
  assert(!rankedGames.includes("mini_escape_room"));

  const spectacleState = baseState({
    game: director.createInitialGameState(),
    memories: [{ content: "publico perguntou sobre o espetaculo Caixa Preta" }],
    conversation: [{ role: "user", content: "e a invencao de Morel?" }]
  });
  const dramaturgyRanked = director.scoreGames(spectacleState).slice(0, 6).map((item) => item.game.id);
  assert(dramaturgyRanked.includes("morel_recording"));
  assert(dramaturgyRanked.includes("black_box_transcript"));
  assert.equal(director.startGame(spectacleState, { requestedGame: "morel", source: "operator" }).gameState.id, "morel_recording");

  const explicitEscape = director.startGame(state, { requestedGame: "escape", source: "operator" });
  assert.equal(explicitEscape.gameState.id, "mini_escape_room");
  const blockedReplacement = director.startGame({ ...state, game: explicitEscape.gameState }, { source: "operator" });
  assert.equal(blockedReplacement.blocked, true);
  assert.equal(blockedReplacement.selection.blockedReason, "game_already_active");
  assert.equal(blockedReplacement.gameState.id, "mini_escape_room");
  const replacementGame = director.startGame({ ...state, game: explicitEscape.gameState }, {
    requestedGame: "cards",
    source: "operator",
    replace: true
  });
  assert.equal(replacementGame.blocked, undefined);
  assert.equal(replacementGame.gameState.id, "cards_style_fill_in");

  state.game = director.createInitialGameState();
  const selectedIds = [];
  for (let index = 0; index < 10; index += 1) {
    const next = director.startGame(state, { source: "operator" });
    selectedIds.push(next.gameState.id);
    const stopped = director.stopGame({ ...state, game: next.gameState }, { status: "completed", source: "test" });
    state.game = {
      ...stopped.gameState,
      cooldownTurnsRemaining: 0
    };
  }
  assert(new Set(selectedIds).size >= 3, `Expected varied games, got ${selectedIds.join(", ")}`);

  const autoTurns = [
    "estamos esperando com tudo parado",
    "tem um casal atrasado e ofegante",
    "o publico esta no celular",
    "silencio de novo",
    "vamos jogar alguma coisa"
  ];
  state = baseState({
    game: director.createInitialGameState(),
    memories: [
      { content: "Beatriz esta aqui e se ofereceu" },
      { content: "alguem chegou atrasado e ofegante" }
    ],
    conversation: autoTurns.map((content, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content
    }))
  });
  const opportunity = director.evaluateGameOpportunity(state, "estamos parados");
  assert.equal(opportunity.shouldStartAutomatic, true);
  const automaticGame = director.startGame(state, { source: "automatic" });
  assert.notEqual(automaticGame.gameState.id, "draw_and_guess");
  assert.notEqual(automaticGame.gameState.id, "pictionary_teams");

  const gossipState = baseState({
    game: director.createInitialGameState(),
    memories: [
      { content: "estamos no ensaio" },
      { content: "vamos tirar fotos hoje" }
    ],
    conversation: [
      { role: "assistant", content: "Time A ganha a honra duvidosa de decidir: jogo rapido, fofoca leve ou acusacao ficticia?" },
      { role: "user", content: "fofoca leve" }
    ]
  });
  const gossipGame = director.startGame(gossipState, { source: "automatic" });
  assert.notEqual(gossipGame.gameState.id, "draw_and_guess");
  assert.notEqual(gossipGame.gameState.id, "pictionary_teams");

  state = baseState({
    game: director.createInitialGameState(),
    memories: [
      { content: "Janaína Leite esta aqui" }
    ],
    conversation: [
      { role: "assistant", content: "digam uma palavra que justifique terem vindo." },
      { role: "user", content: "espetaculo" },
      { role: "assistant", content: "isso virou prova. escolham alguem." }
    ]
  });
  const wordOpportunity = director.evaluateGameOpportunity(state, "saudade");
  assert.equal(wordOpportunity.conversationRun.continueConversation, true);
  assert.equal(wordOpportunity.shouldStartAutomatic, false);

  const taskyState = baseState({
    game: director.createInitialGameState(),
    conversation: [
      { role: "assistant", content: "complete a frase: o teatro sobrevive porque _____." },
      { role: "user", content: "pessoas insistem" }
    ]
  });
  const gameRequestOpportunity = director.evaluateGameOpportunity(taskyState, "me da um jogo");
  assert.equal(gameRequestOpportunity.aiMayStart, true);

  started = director.startGame(state, { requestedGame: "forca", source: "operator" });
  assert.equal(started.gameState.id, "hangman");
  assert.equal(typeof started.gameState.privateData.secretWord, "string");
  assert.equal(started.events.some((event) => event.type === "FULLSCREEN_TEXT"), false);
  let advance = director.advanceGame({ ...state, game: started.gameState }, started.gameState.privateData.secretWord);
  assert.equal(advance.result.completed, true);
  assert.equal(advance.gameState.phase, "completed");
  assert.equal(advance.events.some((event) => event.type === "FULLSCREEN_TEXT"), false);

  started = director.startGame(state, { requestedGame: "maria", source: "operator" });
  assert.equal(started.gameState.id, "who_am_i");
  assert.equal(started.gameState.privateData.secret, null);
  assert.equal(started.gameState.privateData.hiddenFromModel, true);
  assert.equal(started.gameState.publicData.secretKnownToModel, false);
  assert.equal(started.gameState.phase, "awaiting_secret");
  const mariaWithSecret = director.setGameSecret({ ...state, game: started.gameState }, "Anitta");
  assert.equal(mariaWithSecret.applied, true);
  assert.equal(mariaWithSecret.gameState.privateData.secret, "Anitta");
  assert.equal(mariaWithSecret.gameState.publicData.secretKnownToModel, false);
  advance = director.advanceGame({ ...state, game: mariaWithSecret.gameState }, "sim");
  assert.equal(advance.result.type, "yes_no_answer");
  assert.deepEqual(advance.gameState.publicData.answers, ["sim"]);
  const missedGuess = director.applyGameMove({ ...state, game: advance.gameState }, {
    gameMove: "guess_secret",
    guess: "Fernanda Torres"
  });
  assert.equal(missedGuess.result.hit, false);
  assert.equal(missedGuess.gameState.active, true);
  const hitGuess = director.applyGameMove({ ...state, game: missedGuess.gameState }, {
    gameMove: "guess_secret",
    guess: "Anitta"
  });
  assert.equal(hitGuess.result.hit, true);
  assert.equal(hitGuess.gameState.active, false);

  started = director.startGame(state, { requestedGame: "mestre", source: "operator" });
  assert.equal(started.gameState.id, "master_mandou");
  let masterState = started.gameState;
  for (let index = 0; index < 10; index += 1) {
    const command = index % 2 === 0
      ? `Caixa mandou comando ${index}`
      : `comando armadilha ${index}`;
    const moved = director.applyGameMove({ ...state, game: masterState }, {
      gameMove: "master_command",
      command,
      valid: index % 2 === 0
    });
    assert.equal(moved.applied, true);
    masterState = moved.gameState;
    const observed = director.advanceGame({ ...state, game: masterState }, index % 2 === 0 ? "todos obedeceram" : "alguns erraram");
    assert.equal(observed.result.type, "master_observation");
    masterState = observed.gameState;
  }
  assert.equal(masterState.publicData.validCommands, 5);
  assert.equal(masterState.publicData.trapCommands, 5);

  started = director.startGame(state, { requestedGame: "cards", source: "operator" });
  assert.equal(started.gameState.id, "cards_style_fill_in");
  assert.equal(started.gameState.phase, "collect_answers");
  let cardsState = started.gameState;
  for (const answer of ["processo judicial", "um cafe ruim", "a tecnica descansando"]) {
    const collected = director.advanceGame({ ...state, game: cardsState }, answer);
    cardsState = collected.gameState;
  }
  assert.equal(cardsState.phase, "judge");
  const winner = director.applyGameMove({ ...state, game: cardsState }, {
    gameMove: "choose_winner",
    winner: "a tecnica descansando"
  });
  assert.equal(winner.applied, true);
  assert.equal(winner.gameState.active, false);

  started = director.startGame(state, { requestedGame: "desenho", source: "operator" });
  assert.equal(started.gameState.id, "draw_and_guess");
  assert(started.events.some((event) => event.type === "DRAWING"));
  advance = director.advanceGame({ ...state, game: started.gameState }, started.gameState.privateData.secretWord);
  assert.equal(advance.result.completed, true);
  assert(advance.events.some((event) => event.type === "CLEAR_DRAWING"));

  started = director.startGame(state, { requestedGame: "teams", source: "operator" });
  assert.equal(started.gameState.teams.length, 2);
  assert(started.gameState.teams.every((team) => team.participants.length > 0));
  const scored = director.applyGameMove({ ...state, game: started.gameState }, {
    gameMove: "award_point",
    target: "TIME A",
    delta: 2
  });
  assert.equal(scored.applied, true);
  assert.equal(scored.gameState.score.A, 2);

  started = director.startGame(state, { requestedGame: "verdade-ou-bolo", source: "operator" });
  assert.equal(started.gameState.id, "verdade_ou_bolo");
  assert.equal(started.gameState.phase, "VOTING");
  assert.equal(started.gameState.publicData.state, "VOTING");
  assert.equal(started.gameState.publicData.totalRounds, 4);
  assert.equal(started.gameState.publicData.currentRound.number, 1);
  assert.equal(started.gameState.publicData.voteCountdown.durationSeconds, 10);

  let boloState = started.gameState;
  let controlled = director.controlStructuredGame({ ...state, game: boloState }, "video_play");
  assert.equal(controlled.applied, false);
  assert.equal(controlled.result.reason, "answer_not_revealed");
  boloState = controlled.gameState;

  controlled = director.controlStructuredGame({ ...state, game: boloState }, "select_answer", { answer: "verdade" });
  assert.equal(controlled.applied, true);
  assert.equal(controlled.gameState.phase, "VOTING");
  assert.equal(controlled.gameState.publicData.selectedAnswer, "verdade");
  boloState = controlled.gameState;

  controlled = director.controlStructuredGame({ ...state, game: boloState }, "next");
  assert.equal(controlled.applied, false);
  assert.equal(controlled.result.reason, "vote_countdown_running");
  boloState = controlled.gameState;

  controlled = director.controlStructuredGame({ ...state, game: boloState }, "vote_timeout");
  assert.equal(controlled.applied, true);
  assert.equal(controlled.gameState.phase, "ANSWER_LOCKED");
  assert.equal(controlled.gameState.publicData.roundResults.length, 0);
  assert.equal(controlled.gameState.publicData.voteCountdown, null);
  boloState = controlled.gameState;

  const revealNeedsVideoEnd = Boolean(boloState.publicData.currentRound?.video?.src);
  controlled = director.controlStructuredGame({ ...state, game: boloState }, "reveal");
  assert.equal(controlled.applied, true);

  if (revealNeedsVideoEnd) {
    assert.equal(controlled.gameState.phase, "REVEAL");
    assert.equal(controlled.gameState.publicData.revealArmed, true);
    assert.equal(controlled.gameState.publicData.roundResults.length, 0);
    assert.equal(controlled.gameState.publicData.score, 0);
    boloState = controlled.gameState;

    controlled = director.controlStructuredGame({ ...state, game: boloState }, "reveal");
    assert.equal(controlled.applied, true);
    assert.equal(controlled.result.type, "reveal_video_already_playing");
    assert.equal(controlled.gameState.phase, "REVEAL");
    assert.equal(controlled.gameState.publicData.roundResults.length, 0);
    assert.equal(controlled.gameState.publicData.score, 0);
    boloState = controlled.gameState;

    controlled = director.controlStructuredGame({ ...state, game: boloState }, "next");
    assert.equal(controlled.applied, false);
    assert.equal(controlled.result.reason, "reveal_video_playing");
    boloState = controlled.gameState;

    controlled = director.controlStructuredGame({ ...state, game: boloState }, "video_ended");
    assert.equal(controlled.applied, true);
    assert.equal(controlled.gameState.phase, "REVEAL");
    assert.equal(controlled.gameState.publicData.revealArmed, false);
  } else {
    assert.equal(controlled.gameState.phase, "REVEAL");
    assert.equal(controlled.gameState.publicData.revealArmed, false);
  }

  assert.equal(controlled.gameState.publicData.roundResults.length, 1);
  assert.equal(controlled.gameState.publicData.score, 1);
  boloState = controlled.gameState;

  controlled = director.controlStructuredGame({ ...state, game: boloState }, "next");
  assert.equal(controlled.applied, true);
  assert.equal(controlled.gameState.phase, "ROUND_RESULT");
  boloState = controlled.gameState;

  controlled = director.controlStructuredGame({ ...state, game: boloState }, "next");
  assert.equal(controlled.applied, true);
  assert.equal(controlled.gameState.phase, "VOTING");
  assert.equal(controlled.gameState.publicData.currentRound.number, 2);
  assert.equal(controlled.gameState.publicData.voteCountdown.durationSeconds, 10);
  boloState = controlled.gameState;

  controlled = director.controlStructuredGame({ ...state, game: boloState }, "previous_round");
  assert.equal(controlled.applied, true);
  assert.equal(controlled.gameState.publicData.currentRound.number, 1);
  assert.equal(controlled.gameState.publicData.score, 1);
  assert.equal(controlled.gameState.publicData.roundResults.length, 1);
  boloState = controlled.gameState;

  controlled = director.controlStructuredGame({ ...state, game: boloState }, "next_round");
  assert.equal(controlled.applied, true);
  assert.equal(controlled.gameState.publicData.currentRound.number, 2);
  assert.equal(controlled.gameState.phase, "VOTING");
  boloState = controlled.gameState;

  assert.equal(boloState.phase, "VOTING");
  assert.equal(boloState.publicData.selectedAnswer, null);
  assert.equal(boloState.publicData.voteCountdown.durationSeconds, 10);

  controlled = director.controlStructuredGame({ ...state, game: boloState }, "vote_timeout");
  assert.equal(controlled.applied, true);
  assert.equal(controlled.gameState.phase, "ROUND_RESULT");
  assert.equal(controlled.gameState.publicData.result.noVote, true);
  assert.equal(controlled.gameState.publicData.result.won, false);
  assert.equal(controlled.gameState.publicData.result.selected, null);
  assert.equal(controlled.gameState.publicData.score, 1);
  assert.equal(controlled.gameState.publicData.autoAdvanceCommand.action, "next");
  boloState = controlled.gameState;

  controlled = director.controlStructuredGame({ ...state, game: boloState }, "next");
  assert.equal(controlled.applied, true);
  assert.equal(controlled.gameState.phase, "VOTING");
  assert.equal(controlled.gameState.publicData.currentRound.number, 3);

  console.log("GAME DIRECTOR: PASS");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.writeFileSync(publicoPath, originalPublico);
  });
