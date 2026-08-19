const assert = require("node:assert/strict");

async function main() {
  const baralho = await import("../lib/baralho-morbido/state.js");

  let state = baralho.createInitialBaralhoMorbidoState();
  let busyResult = baralho.drawBaralhoMorbidoCard({
    ...state,
    phase: baralho.BARALHO_MORBIDO_PHASES.SHUFFLING
  });

  assert.equal(busyResult.applied, false);
  assert.equal(busyResult.reason, "busy");

  const drawn = [];
  for (let index = 0; index < 10; index += 1) {
    const result = baralho.drawBaralhoMorbidoCard(state, { random: () => 0 });
    assert.equal(result.applied, true);
    assert(!drawn.includes(result.card.id));
    drawn.push(result.card.id);
    state = baralho.setBaralhoMorbidoPhase(result.state, baralho.BARALHO_MORBIDO_PHASES.PLAYING);
  }

  assert.equal(new Set(drawn).size, 10);
  assert.equal(state.usedIds.length, 10);
  assert.equal(state.remainingIds.length, 0);

  const exhausted = baralho.drawBaralhoMorbidoCard(state);
  assert.equal(exhausted.applied, false);
  assert.equal(exhausted.reason, "finished");
  assert.equal(exhausted.state.phase, baralho.BARALHO_MORBIDO_PHASES.FINISHED);

  state = baralho.createInitialBaralhoMorbidoState();
  assert.equal(state.usedIds.length, 0);
  assert.equal(state.remainingIds.length, 10);

  console.log("baralho-morbido-test: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
