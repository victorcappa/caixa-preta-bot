const assert = require("node:assert/strict");

async function main() {
  const sceneZero = await import("../lib/scene-zero/state.js");
  const messageTiming = await import("../lib/messageTiming.js");
  const initial = sceneZero.createInitialSceneZeroState();

  assert.equal(initial.stage, "idle");
  assert.equal(initial.timer.remainingSeconds, 15);
  assert.equal(initial.glitchLevel, "normal");
  assert.equal(sceneZero.normalizeSceneZeroStage("airport"), "airport");
  assert.equal(sceneZero.normalizeSceneZeroStage("automatic-timeline"), null);

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
  assert.match(direction, /Perguntas anteriores/);
  assert.match(direction, /não devem ser repetidas/);
  assert(!direction.includes("Bata três palmas quem veio de transporte público"));

  const participantDirection = sceneZero.buildSceneZeroDirection(
    { ...initial, stage: "participant" },
    "participant_roulette_sequence"
  );
  assert.match(participantDirection, /10 segundos/);
  assert.match(participantDirection, /sarcástico, informal e Gen Z/);

  const normalMessageContext = sceneZero.buildSceneZeroContext({ ...initial, stage: "participant" });
  assert.match(normalMessageContext, /uma fala da Caixa Preta deve terminar completamente/);
  const glitchMessageContext = sceneZero.buildSceneZeroContext({ ...initial, stage: "glitch", glitchLevel: "glitch-2" });
  assert.match(glitchMessageContext, /podem coexistir várias falas/);
  assert.match(glitchMessageContext, /conversando entre si/);
  assert.equal(sceneZero.sceneZeroGlitchCommand("glitch-1").action, "trigger");
  assert.equal(sceneZero.sceneZeroGlitchCommand("glitch-4").action, "trigger");
  assert.equal(sceneZero.sceneZeroGlitchCommand("glitch-4").payload.durationMs, 1800);
  assert.equal(sceneZero.sceneZeroGlitchCommand("collapse").action, "continuous");

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
