import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "caixa-live-training-unit-"));
for (const item of ["knowledge", "data", "assets/tarot/CAIXA_PRETA_REFERENCIAS_TARO.md"]) {
  fs.mkdirSync(path.dirname(path.join(directory, item)), { recursive: true });
  fs.cpSync(path.join(repository, item), path.join(directory, item), { recursive: true });
}
fs.writeFileSync(path.join(directory, "data/training-examples.json"), "[]");
fs.writeFileSync(path.join(directory, "data/style-notes.json"), "[]");
process.env.CAIXA_PRETA_SHOW_RUNTIME_DIR = path.join(directory, "runtime");
process.chdir(directory);
registerHooks({ resolve(specifier, context, nextResolve) {
  let url;
  if (specifier.startsWith("@/")) url = pathToFileURL(path.resolve(repository, specifier.slice(2))).href;
  else if (specifier.startsWith(".")) url = new URL(specifier, context.parentURL).href;
  if (url?.startsWith("file:") && !path.extname(fileURLToPath(url)) && fs.existsSync(`${fileURLToPath(url)}.js`)) return nextResolve(`${url}.js`, context);
  return nextResolve(url || specifier, context);
} });

try {
  const { createLiveTrainingState, createLiveTrainingController, liveTrainingSnapshot, restoredLiveTrainingState } = await import("../lib/liveTraining.js");
  const { saveTrainingExample, listTrainingExamples, buildTrainingContextBlock } = await import("../lib/training.js");
  const { liveTrainingContext } = await import("../lib/liveTrainingContext.js");
  const channel = createLiveTrainingState();
  const control = createLiveTrainingController({ get: () => channel, emit() {}, saveExample: saveTrainingExample });
  assert(control.begin({ requestId: "invalid-alternative", parentId: "" }).error);
  assert.equal(channel.messages.length, 0, "uma alternativa sem resposta de origem não pode iniciar uma conversa");
  const first = control.begin({ requestId: "first", text: "Como Morel se relaciona com a memória e a peça?" });
  assert.equal(control.begin({ requestId: "busy", text: "outra" }).busy, true);
  control.append(first, "Morel devolve uma memória sem corpo.");
  control.finish(first);
  assert.equal(control.begin({ requestId: "first", text: "duplicada" }).duplicate, true);
  assert.equal(control.rate(first.messageId, "perfect").ok, true);
  assert.equal(control.rate(first.messageId, "almost").ok, true);
  assert.equal(control.rate(first.messageId, "bad").ok, true);
  assert.equal(listTrainingExamples().length, 1, "requalificar deve atualizar o exemplo, sem multiplicar votos");
  assert.equal(listTrainingExamples()[0].rating, "bad");
  const training = buildTrainingContextBlock({ mode: "live-training", userMessage: "Morel" });
  assert(training.includes("AVOID: Morel"));
  assert(!training.includes("PREFER: Morel"), "uma avaliação ruim sem correção não pode recomendar a mesma resposta");
  const alternativeJob = control.begin({ requestId: "alternatives", parentId: first.messageId });
  assert.equal(alternativeJob.parentId, first.messageId);
  control.finish(alternativeJob, { alternatives: ["Uma imagem que insiste.", "Um corpo que falta.", "Uma cópia que responde."] });
  assert.equal(channel.messages.filter(message => message.kind === "alternative").length, 3);
  assert.equal(control.begin({ requestId: "alternatives", parentId: first.messageId }).duplicate, true);
  const projected = liveTrainingSnapshot(channel);
  assert.equal(projected.messages.length, 5);
  assert(!JSON.stringify(projected).includes('"rating"'));
  assert(!JSON.stringify(projected).includes("completedRequests"));
  const context = await liveTrainingContext({ liveTraining: channel, memories: [{ content: "O corpo holográfico atravessa esta conversa." }],
    conversation: [{ role: "user", content: "Memória registrada da peça." }], sceneZero: { notes: "CONTROLLER_PRIVATE_SENTINEL" } });
  assert(context.sources.includes("knowledge/dramaturgy.md"));
  assert(context.sources.includes("assets/tarot/CAIXA_PRETA_REFERENCIAS_TARO.md"), "o acervo extenso de referências deve estar disponível por recuperação");
  assert(context.knowledge.includes("Morel"));
  assert(!JSON.stringify(context).includes("CONTROLLER_PRIVATE_SENTINEL"));
  const cancelled = control.begin({ requestId: "cancelled", text: "parar" });
  control.cancel();
  assert.equal(cancelled.controller.signal.aborted, true);
  assert.equal(control.append(cancelled, "atrasado"), false);
  assert.equal(control.finish(cancelled), false);
  const retry = control.begin({ requestId: "cancelled", text: "parar" });
  assert.equal(retry.messageId, cancelled.messageId);
  assert.equal(control.append(cancelled, "callback antigo"), false, "o retry do mesmo ID não pode aceitar tokens da tentativa cancelada");
  assert.equal(control.finish(cancelled, { error: "falha antiga" }), false, "a tentativa cancelada não pode encerrar a nova geração");
  assert.equal(channel.messages.filter(message => message.id === "cancelled").length, 1);
  const recovered = restoredLiveTrainingState(channel);
  assert.equal(recovered.status, "idle");
  assert.equal(recovered.messages.at(-1).status, "cancelled");
  control.cancel();

  const { showState } = await import("../lib/showState.js");
  const { flushSnapshotWrites } = await import("../lib/showSessionPersistence.js");
  const recoveryJob = showState.liveTraining.begin({ requestId: "recovery-job", text: "guardar esta conversa" });
  showState.liveTraining.append(recoveryJob, "Uma resposta em andamento.");
  const saved = showState.privateSnapshot();
  assert.equal(showState.restoreFromRecovery({ storeVersion: showState._storeVersion, sessionId: saved.reliability.sessionId, state: saved }).ok, true);
  assert.equal(recoveryJob.controller.signal.aborted, true);
  assert.equal(showState.snapshot().liveTraining.messages.at(-1).status, "cancelled");
  assert.equal(showState.snapshot().liveTraining.messages.at(-1).content, "Uma resposta em andamento.");
  const active = showState.liveTraining.begin({ requestId: "reset-job", text: "reset" });
  showState.startNewPresentation();
  assert.equal(active.controller.signal.aborted, true);
  assert.equal(showState.snapshot().liveTraining.messages.length, 0);
  const stopped = showState.liveTraining.begin({ requestId: "stop-job", text: "stop" });
  showState.signalStopAll();
  assert.equal(stopped.controller.signal.aborted, true);
  const emergency = showState.liveTraining.begin({ requestId: "emergency-job", text: "emergency" });
  showState.controlReliability("emergency-on");
  assert.equal(emergency.controller.signal.aborted, true);
  showState.controlReliability("emergency-off");
  showState.startNewPresentation();
  await flushSnapshotWrites();
  console.log("LIVE TRAINING PASS: ratings/upsert, negative feedback, alternatives, corpus, public boundary, retry, recovery, reset, STOP ALL and emergency (isolated fixtures)");
} finally {
  process.chdir(repository);
}
