const assert = require("node:assert/strict");

async function main() {
  const sceneZero = await import("../lib/scene-zero/state.js");
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

  console.log("scene-zero-test: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
