const assert = require("node:assert/strict");

async function main() {
  const baralho = await import("../lib/baralho-morbido/state.js");
  const { createBaralhoMorbidoCards } = await import("../lib/baralho-morbido/config.js");
  const { loadBaralhoMorbidoCards } = await import("../lib/baralho-morbido/assets.js");
  const cards = createBaralhoMorbidoCards(["911.mp4", "asian-airlines.mp4", "brace.webm"]);

  let state = baralho.createInitialBaralhoMorbidoState(cards);
  let busyResult = baralho.drawBaralhoMorbidoCard({
    ...state,
    phase: baralho.BARALHO_MORBIDO_PHASES.SHUFFLING
  });

  assert.equal(busyResult.applied, false);
  assert.equal(busyResult.reason, "busy");

  const drawn = [];
  for (let index = 0; index < cards.length; index += 1) {
    const result = baralho.drawBaralhoMorbidoCard(state, { random: () => 0 });
    assert.equal(result.applied, true);
    assert(!drawn.includes(result.card.id));
    drawn.push(result.card.id);
    state = baralho.setBaralhoMorbidoPhase(result.state, baralho.BARALHO_MORBIDO_PHASES.PLAYING);
  }

  assert.equal(new Set(drawn).size, cards.length);
  assert.equal(state.usedIds.length, cards.length);
  assert.equal(state.remainingIds.length, 0);

  const exhausted = baralho.drawBaralhoMorbidoCard(state);
  assert.equal(exhausted.applied, false);
  assert.equal(exhausted.reason, "finished");
  assert.equal(exhausted.state.phase, baralho.BARALHO_MORBIDO_PHASES.FINISHED);

  const expandedCards = createBaralhoMorbidoCards(["911.mp4", "asian-airlines.mp4", "brace.webm", "nova.mp4"]);
  const expanded = baralho.syncBaralhoMorbidoCards(exhausted.state, expandedCards);
  assert.equal(expanded.state.phase, baralho.BARALHO_MORBIDO_PHASES.PLAYING);
  assert.deepEqual(expanded.state.remainingIds, ["nova"]);

  state = baralho.createInitialBaralhoMorbidoState(cards);
  assert.equal(state.usedIds.length, 0);
  assert.equal(state.remainingIds.length, cards.length);

  const folderCards = loadBaralhoMorbidoCards();
  assert(Array.isArray(folderCards));
  assert(folderCards.every((card) => card.video.path.startsWith("videos/baralho-morbido/")));

  const refreshedCards = createBaralhoMorbidoCards(["novo.mp4", "911.mp4"]);
  const synced = baralho.syncBaralhoMorbidoCards(state, refreshedCards);
  assert.equal(synced.changed, true);
  assert.deepEqual(synced.state.remainingIds, ["novo", "911"]);
  assert.equal(synced.state.totalCards, 2);

  console.log("baralho-morbido-test: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
