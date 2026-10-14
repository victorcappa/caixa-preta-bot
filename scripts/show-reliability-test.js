import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  allowSnapshotWritesForBoot,
  createSnapshotEnvelope,
  flushSnapshotWrites,
  readSnapshot,
  scheduleSnapshotWrite,
  validateSnapshotEnvelope,
  writeSnapshotAtomic
} from "../lib/showSessionPersistence.js";
import {
  ExternalRequestBlockedError,
  ExternalRequestTimeoutError,
  runExternalRequest,
  setExternalRequestsBlocked
} from "../lib/externalRequestControl.js";
import { localFallbackTurn } from "../lib/showFallback.js";
import { buildShowHealthReport } from "../lib/showHealth.js";

const directory = await fs.mkdtemp(path.join(os.tmpdir(), "caixa-preta-reliability-"));

try {
  const state = {
    sceneZero: { stage: "suitcases", suitcaseGame: { status: "playing", currentSuitcase: 2 } },
    reliability: { emergencyMode: { active: false } },
    memories: [{ content: "snapshot marker" }]
  };
  const envelope = createSnapshotEnvelope({
    storeVersion: "test-v1",
    sessionId: "session-a",
    bootId: "boot-a",
    revision: 17,
    summary: { scene: "suitcases", step: "playing / mala-2" },
    state
  });

  await writeSnapshotAtomic(envelope, { directory });
  const saved = await readSnapshot({ directory, expectedStoreVersion: "test-v1" });
  assert.equal(saved.status, "available", "snapshot deve ser salvo e lido");
  assert.deepEqual(saved.envelope.state, state, "snapshot deve preservar estado restaurável");
  assert.equal(validateSnapshotEnvelope(saved.envelope, { expectedStoreVersion: "test-v1" }).valid, true);

  const nextBoot = createSnapshotEnvelope({
    storeVersion: "test-v1",
    sessionId: "session-b",
    bootId: "boot-b",
    revision: 1,
    summary: { scene: "boot", step: "idle" },
    state: { memories: [] }
  });
  scheduleSnapshotWrite(nextBoot, { directory, debounceMs: 0 });
  await flushSnapshotWrites({ directory });
  assert.equal((await readSnapshot({ directory })).envelope.bootId, "boot-a", "novo boot não deve sobrescrever snapshot antes da escolha");
  allowSnapshotWritesForBoot("boot-b");
  scheduleSnapshotWrite(nextBoot, { directory, debounceMs: 0 });
  await flushSnapshotWrites({ directory });
  assert.equal((await readSnapshot({ directory })).envelope.bootId, "boot-b", "escolha explícita deve liberar o novo boot");

  await fs.writeFile(path.join(directory, "current.json"), "{corrompido", "utf8");
  const corrupted = await readSnapshot({ directory, expectedStoreVersion: "test-v1" });
  assert.equal(corrupted.status, "corrupted", "JSON corrompido deve ser rejeitado");

  await assert.rejects(
    runExternalRequest("openai", (signal) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }), { timeoutMs: 250 }),
    ExternalRequestTimeoutError,
    "OpenAI lento deve expirar"
  );

  await assert.rejects(
    runExternalRequest("openai", async () => { throw new Error("offline"); }),
    /offline/,
    "OpenAI offline deve liberar o chamador"
  );

  const fallback = localFallbackTurn({ state, userMessage: "a mala falhou", reason: "offline" });
  assert.equal(fallback.fallback.active, true);
  assert.equal(fallback.events.length, 0);
  assert.ok(fallback.text.length > 0, "fallback local deve produzir fala");

  setExternalRequestsBlocked(true);
  await assert.rejects(runExternalRequest("openai", async () => "late"), ExternalRequestBlockedError);
  setExternalRequestsBlocked(false);
  assert.equal(await runExternalRequest("openai", async () => "ok"), "ok", "Modo Emergência deve poder ser desligado");

  const health = buildShowHealthReport({
    storage: { ok: true },
    internet: { status: "offline", error: "SIMULATED" },
    openAI: { configured: true, status: "offline" }
  });
  assert.equal(health.ok, true, "falha opcional não deve derrubar core");
  assert.equal(health.optional.internet.status, "offline");

  console.log("SHOW RELIABILITY UNIT OK");
} finally {
  await fs.rm(directory, { recursive: true, force: true });
}
