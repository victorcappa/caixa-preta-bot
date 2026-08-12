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

  const rankedGames = director.scoreGames(state).slice(0, 10).map((item) => item.game.id);
  assert(rankedGames.includes("hangman"));
  assert(rankedGames.includes("who_am_i"));
  assert(rankedGames.includes("cards_style_fill_in"));
  assert(!rankedGames.includes("mini_escape_room"));

  const explicitEscape = director.startGame(state, { requestedGame: "escape", source: "operator" });
  assert.equal(explicitEscape.gameState.id, "mini_escape_room");
  const replacementGame = director.startGame({ ...state, game: explicitEscape.gameState }, { source: "operator" });
  assert.notEqual(replacementGame.gameState.id, "mini_escape_room");
  const preferredReplacementIds = [
    "hangman",
    "who_am_i",
    "cards_style_fill_in",
    "draw_and_guess",
    "complete_phrase",
    "guess_the_rule",
    "secret_rule",
    "yes_no_forbidden",
    "forbidden_word",
    "collective_judgment"
  ];
  assert(preferredReplacementIds.includes(replacementGame.gameState.id));

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
  assert.equal(wordOpportunity.aiMayStart, true);
  assert.equal(wordOpportunity.shouldStartAutomatic, true);

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
  assert.equal(typeof started.gameState.privateData.secret, "string");
  assert.equal(started.gameState.phase, "yes_no_questions");

  started = director.startGame(state, { requestedGame: "desenho", source: "operator" });
  assert.equal(started.gameState.id, "draw_and_guess");
  assert(started.events.some((event) => event.type === "DRAWING"));

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
