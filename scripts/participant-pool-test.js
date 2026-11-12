import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "caixa-participant-pool-"));
const originalCwd = process.cwd();
process.env.CAIXA_PRETA_SHOW_RUNTIME_DIR = path.join(directory, "runtime");
fs.mkdirSync(path.join(directory, "data"));
const groups = [
  { name: "equipe", nomes: ["Pessoa da equipe"] },
  { name: "publico", nomes: ["Ana", "Carlos", "Ana"] }
];
const saveGroups = () => fs.writeFileSync(path.join(directory, "data", "publico.json"), JSON.stringify(groups));
saveGroups();
process.chdir(directory);

registerHooks({ resolve(specifier, context, nextResolve) {
  let url;
  if (specifier.startsWith("@/")) url = pathToFileURL(path.resolve(repository, specifier.slice(2))).href;
  else if (specifier.startsWith(".")) url = new URL(specifier, context.parentURL).href;
  if (url?.startsWith("file:") && !path.extname(fileURLToPath(url)) && fs.existsSync(`${fileURLToPath(url)}.js`)) {
    return nextResolve(`${url}.js`, context);
  }
  return nextResolve(url || specifier, context);
} });

try {
  const { getParticipantPool } = await import("../lib/participants.js");
  const { buildGameContext, startGame } = await import("../lib/host/GameDirector.js");
  const { showState } = await import("../lib/showState.js");
  const { createSnapshotEnvelope, flushSnapshotWrites } = await import("../lib/showSessionPersistence.js");
  const sessionParticipants = [
    { name: "Pessoa da equipe", source: "session", present: "true" },
    { name: "Nome lembrado", source: "session", present: "true" }
  ];
  const history = { ana: { selectedCount: 20, lastSelectedAt: "2026-11-01T12:00:00Z" } };
  const options = { sessionParticipants, history, selectionScope: "audience-only" };
  const filtered = getParticipantPool(options);
  assert.deepEqual(filtered.participants.map(({ name }) => name), ["Ana", "Carlos"]);
  assert.deepEqual(filtered.counts, { team: 0, audience: 2, session: 0, available: 2 });
  assert.equal(filtered.participants[0].selectedCount, 20, "selection history is preserved");
  for (const selectionScope of [undefined, "all", "audience-only"]) {
    assert.deepEqual(getParticipantPool({ ...options, selectionScope }), filtered, "every scope prioritizes the audience");
    const participants = { session: sessionParticipants, history, selectionScope };
    assert.deepEqual(buildGameContext({ participants }).participantPool, filtered);
    const game = startGame({ participants }, { requestedGame: "teams", source: "operator" });
    assert(game.gameState.participants.length > 0);
    assert(game.gameState.participants.every(({ source }) => source === "audience"), "games must not fill remaining places with the team");
  }

  groups[1].nomes = [];
  saveGroups();
  const teamPool = getParticipantPool(options);
  assert.deepEqual(teamPool.participants.map(({ name, source }) => ({ name, source })), [{ name: "Pessoa da equipe", source: "team" }]);
  assert.deepEqual(teamPool.counts, { team: 1, audience: 0, session: 0, available: 1 });
  assert.equal(teamPool.audienceAvailable, false);
  for (const selectionScope of [undefined, "all", "audience-only"]) {
    assert.deepEqual(getParticipantPool({ ...options, selectionScope }), teamPool, "empty audience falls back only to the team in every scope");
    const game = startGame({ participants: { session: sessionParticipants, selectionScope } }, { source: "operator" });
    assert(game.gameState.participants.length > 0);
    assert(game.gameState.participants.every(({ source }) => source === "team"));
  }
  const teamDraw = showState.prepareSceneZeroParticipantSelection();
  assert.equal(teamDraw.applied, true);
  assert.equal(teamDraw.winner.source, "team");
  assert(teamDraw.candidates.every(({ source }) => source === "team"));
  showState.startNewPresentation();

  groups[1].nomes = [" ", "..."];
  saveGroups();
  assert.deepEqual(getParticipantPool(options), teamPool, "blank audience entries do not prevent team fallback");
  groups[0].nomes = [];
  saveGroups();
  assert.equal(getParticipantPool(options).participants.length, 0, "memory alone must never enter the draw");
  assert.equal(showState.prepareSceneZeroParticipantSelection().applied, false);
  groups[0].nomes = ["Ana", "Pessoa da equipe"];
  groups[1].nomes = ["Ana"];
  saveGroups();
  assert.equal(getParticipantPool(options).participants[0].source, "audience", "a name in both groups belongs to the audience pool");
  assert.equal(getParticipantPool(options).counts.team, 0);

  groups[0].nomes = ["Pessoa da equipe"];
  groups[1].nomes = ["Ana", "Carlos"];
  saveGroups();

  const before = showState.snapshot();
  const changed = showState.setParticipantSelectionScope("audience-only");
  assert.equal(changed.ok, true);
  assert.deepEqual(changed.participants.counts, filtered.counts);
  assert.equal(showState.snapshot().reliability.sessionId, before.reliability.sessionId);
  assert.deepEqual(showState.snapshot().sceneZero, before.sceneZero);
  assert.equal(showState.setParticipantSelectionScope("invalid").ok, false);

  const prepared = showState.prepareSceneZeroParticipantSelection();
  assert.equal(prepared.applied, true);
  assert(prepared.candidates.every(({ source }) => source === "audience"));
  assert.equal(prepared.winner.source, "audience");
  assert.equal(showState.setParticipantSelectionScope("all").ok, false, "cannot change candidates during a draw");

  const savedState = showState.privateSnapshot();
  const envelope = createSnapshotEnvelope({
    storeVersion: showState._storeVersion,
    sessionId: savedState.reliability.sessionId,
    bootId: savedState.reliability.bootId,
    revision: savedState.revision,
    state: savedState
  });
  showState.startNewPresentation();
  assert.equal(showState.snapshot().participants.selectionScope, "all");
  assert.equal(showState.snapshot().participants.counts.team, 0);
  assert.equal(showState.restoreFromRecovery(envelope).ok, true);
  assert.equal(showState.snapshot().participants.selectionScope, "audience-only");
  assert.deepEqual(showState.snapshot().participants.counts, filtered.counts);
  groups[1].nomes = [];
  saveGroups();
  assert.deepEqual(showState.snapshot().participants.counts, teamPool.counts, "recovered audience-only sessions also fall back to the team");
  const recoveredTeamDraw = showState.prepareSceneZeroParticipantSelection();
  assert.equal(recoveredTeamDraw.applied, true);
  assert.equal(recoveredTeamDraw.winner.source, "team");
  showState.startNewPresentation();
  await flushSnapshotWrites();
  console.log("PASS participant draws: audience priority, team fallback, legacy scopes, games, session recovery and reset (isolated fixtures)");
} finally {
  process.chdir(originalCwd);
}
