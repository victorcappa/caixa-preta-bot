import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";
import { mock } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { AUDIENCE_WARMUP_ACTIONS, AUDIENCE_WARMUP_PROMPTS } from "../data/audience-warmup-prompts.js";
import { createAudienceWarmupSequence } from "../lib/audienceWarmup.js";
import { CURRENT_AFFAIRS_CONTEXT_PROMPTS, currentAffairsPrompts, currentAffairsWeek, publishedWarmupPromptIds, validateCurrentAffairsEdition } from "../lib/audienceWarmupCurrentAffairs.js";
import { setExternalRequestsBlocked } from "../lib/externalRequestControl.js";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "caixa-warmup-news-"));
process.env.CAIXA_PRETA_SHOW_RUNTIME_DIR = directory;
const { createCurrentAffairsStore } = await import("../lib/audienceWarmupCurrentAffairsStore.js");
const seed = JSON.parse(fs.readFileSync("data/audience-warmup-current-affairs.json", "utf8"));
validateCurrentAffairsEdition(seed, { requireDirectAction: true });
assert(CURRENT_AFFAIRS_CONTEXT_PROMPTS.length >= 14, "repertório oferece ao menos catorze perguntas temáticas");
assert.equal(new Set(CURRENT_AFFAIRS_CONTEXT_PROMPTS.map((prompt) => prompt.id)).size, CURRENT_AFFAIRS_CONTEXT_PROMPTS.length);
assert.equal(new Set(CURRENT_AFFAIRS_CONTEXT_PROMPTS.map((prompt) => prompt.text)).size, CURRENT_AFFAIRS_CONTEXT_PROMPTS.length);
const gesturePatterns = {
  hand: /LEVANTA A MÃO\.$/u,
  pose: /(?:CRUZA OS BRAÇOS|COLOCA AS MÃOS SOBRE A CABEÇA)\.$/u,
  touch_self: /TOCA A PRÓPRIA CABEÇA\.$/u,
  mime: /FAZ UMA MÍMICA/u,
  point: /APONTA/u,
  sound: /FAZ COM A BOCA O SOM/u,
  move: /(?:SE ABANA|VIRA A CABEÇA)/u,
  freeze: /FICA IMÓVEL\.$/u,
  eyes: /FECHA OS OLHOS\.$/u
};
for (const prompt of [...CURRENT_AFFAIRS_CONTEXT_PROMPTS, ...currentAffairsPrompts(seed)]) {
  assert.match(prompt.id, /^atualidades-/u);
  assert(prompt.text.length <= 180, `${prompt.id}: fala curta para a plateia`);
  assert.match(prompt.text, /^(?:QUEM|SE .+, QUEM|TODOS|TODO MUNDO)\b/u, `${prompt.id}: pergunta ou desafio começa na experiência da plateia`);
  assert(AUDIENCE_WARMUP_ACTIONS.some((action) => action.id === prompt.action), `${prompt.id}: ação registrada`);
  assert(gesturePatterns[prompt.action], `${prompt.id}: gesto verificável`);
  assert.match(prompt.text, gesturePatterns[prompt.action], `${prompt.id}: gesto corresponde à ação`);
  assert.doesNotMatch(prompt.text, /\b(?:EM \d{1,2} DE|\d{4})\b/u, `${prompt.id}: fala pública sem preâmbulo de notícia datada`);
}
const cyberPrompt = CURRENT_AFFAIRS_CONTEXT_PROMPTS.find((prompt) => prompt.id === "atualidades-pandemia-cibernetica");
assert.match(cyberPrompt.text, /^SE UMA PANDEMIA CIBERNÉTICA DERRUBASSE/u, "pandemia cibernética permanece como hipótese");
assert.equal(currentAffairsWeek(new Date("2026-11-16T02:59:59Z")), "2026-11-09");
assert.equal(currentAffairsWeek(new Date("2026-11-16T03:00:00Z")), "2026-11-16");
assert.equal(currentAffairsWeek(new Date("2027-01-01T12:00:00Z")), "2026-12-28");
const mutate = (change) => { const edition = structuredClone(seed); change(edition); return edition; };
assert.throws(() => validateCurrentAffairsEdition(mutate((edition) => { edition.items[0].eventDate = "2026-12-01"; })), /FORA_DA_SEMANA/u);
assert.throws(() => validateCurrentAffairsEdition(mutate((edition) => { edition.items[0].source.publishedAt = "2025-11-05"; })), /FORA_DA_SEMANA/u);
assert.throws(() => validateCurrentAffairsEdition(mutate((edition) => { edition.items[0].region = "mundo"; })), /COBERTURA/u);
assert.throws(() => validateCurrentAffairsEdition(mutate((edition) => { edition.items[0].importance = 2; })), /RELEVANCIA/u);
assert.throws(() => validateCurrentAffairsEdition(seed, { sourceUrls: new Set() }), /FONTE_NAO_PESQUISADA/u);
const legacyEdition = mutate((edition) => {
  edition.items[0].text = `EM 5 DE NOVEMBRO, SÃO PAULO ATIVOU UM GABINETE DE CRISE PARA TEMPORAIS. ${edition.items[0].text}`;
});
validateCurrentAffairsEdition(legacyEdition);
assert.throws(() => validateCurrentAffairsEdition(legacyEdition, { requireDirectAction: true }), /ACAO_INVALIDA/u, "novas edições recusam a notícia antes da pergunta");
assert.equal(currentAffairsPrompts(legacyEdition)[0].text, seed.items[0].text, "edição antiga projeta somente a pergunta corporal");
assert.equal(legacyEdition.items[0].fact, seed.items[0].fact, "compatibilidade preserva metadados privados");
assert.match(legacyEdition.items[0].text, /^EM 5 DE NOVEMBRO/u, "extração pública não reescreve a edição salva");
for (const directText of [
  "SE VOCÊ JÁ RECEBEU ALERTA DE EMERGÊNCIA NO CELULAR, LEVANTA A MÃO.",
  "TODOS QUE JÁ RECEBERAM ALERTA DE EMERGÊNCIA NO CELULAR LEVANTAM A MÃO.",
  "TODO MUNDO QUE JÁ RECEBEU ALERTA DE EMERGÊNCIA NO CELULAR LEVANTA A MÃO."
]) {
  const directEdition = mutate((edition) => { edition.items[0].text = directText; });
  validateCurrentAffairsEdition(directEdition, { requireDirectAction: true });
  assert.equal(currentAffairsPrompts(directEdition)[0].text, directText, "perguntas diretas preservam a formulação");
  directEdition.items[0].text = `EM 5 DE NOVEMBRO, SÃO PAULO ATIVOU UM GABINETE DE CRISE. ${directText}`;
  assert.equal(currentAffairsPrompts(directEdition)[0].text, directText, "cache antigo extrai a ação em cada formulação permitida");
}
const longEdition = mutate((edition) => { edition.items[0].text = `QUEM JÁ RECEBEU ${"UM ALERTA ".repeat(20)}LEVANTA A MÃO.`; });
assert.throws(() => validateCurrentAffairsEdition(longEdition, { requireDirectAction: true }), /ACAO_INVALIDA/u, "novas falas longas são recusadas");

let date = new Date(seed.updatedAt);
let calls = 0;
const store = createCurrentAffairsStore({ filePath: path.join(directory, "edition.json"), seed, now: () => date, generate: async () => {
  calls += 1;
  return { items: seed.items, sourceUrls: new Set(seed.items.map((item) => item.source.url)) };
} });
await store.refresh();
assert.equal(calls, 0, "edição atual não deve consultar o modelo");
for (const prompt of CURRENT_AFFAIRS_CONTEXT_PROMPTS) {
  assert(store.snapshot().prompts.some((candidate) => candidate.id === prompt.id), "temas solicitados entram na edição atual");
}
await Promise.all([store.refresh({ force: true }), store.refresh({ force: true })]);
assert.equal(calls, 1, "operadores simultâneos compartilham uma única pesquisa");
assert.equal(store.snapshot().stale, false);
assert.equal(fs.existsSync(path.join(directory, "edition.json")), true);
const reloaded = createCurrentAffairsStore({ filePath: path.join(directory, "edition.json"), now: () => date });
assert.equal(reloaded.snapshot().week, seed.week, "cache sobrevive à recriação do serviço");
date = new Date("2026-11-16T03:00:00Z");
assert.equal(store.snapshot().stale, true);
assert.equal(store.snapshot().prompts[0].currentAffairsFallback, true, "edição passada não deve virar notícia atual");
for (const prompt of CURRENT_AFFAIRS_CONTEXT_PROMPTS) {
  assert(store.snapshot().prompts.some((candidate) => candidate.id === prompt.id), "temas solicitados permanecem disponíveis sem edição semanal");
}
await store.refresh();
await store.refresh();
assert.equal(calls, 2, "falha de validação só tenta novamente após seis horas");
assert.match(store.snapshot().error, /FORA_DA_SEMANA/u);
assert.equal(JSON.parse(fs.readFileSync(path.join(directory, "edition.json"))).week, seed.week, "falha preserva o último cache válido");
setExternalRequestsBlocked(true);
assert.equal((await store.refresh({ force: true })).error, "EXTERNAL_REQUESTS_BLOCKED");
assert.equal(calls, 2, "modo emergência impede atualização externa");
setExternalRequestsBlocked(false);
const nextEditionItems = seed.items.map((item) => ({ ...item, eventDate: "2026-11-16", source: { ...item.source, publishedAt: "2026-11-16" } }));
const nextStore = createCurrentAffairsStore({ filePath: path.join(directory, "edition.json"), now: () => date,
  generate: async () => ({ items: nextEditionItems, sourceUrls: new Set(nextEditionItems.map((item) => item.source.url)) }) });
assert.equal((await nextStore.refresh()).week, "2026-11-16");
assert.equal(nextStore.snapshot().stale, false, "nova semana publica uma edição completa");

registerHooks({ resolve(specifier, context, nextResolve) {
  let url;
  if (specifier.startsWith("@/")) url = pathToFileURL(path.resolve(specifier.slice(2))).href;
  else if (specifier.startsWith(".")) url = new URL(specifier, context.parentURL).href;
  if (url?.startsWith("file:") && !path.extname(fileURLToPath(url)) && fs.existsSync(`${fileURLToPath(url)}.js`)) return nextResolve(`${url}.js`, context);
  return nextResolve(url || specifier, context);
} });
const { showState } = await import("../lib/showState.js");
const { flushSnapshotWrites } = await import("../lib/showSessionPersistence.js");
const initial = showState.privateSnapshot();
const warmup = () => showState.snapshot().audienceWarmup;
function action(name, payload = {}) {
  const result = showState.controlAudienceWarmup(name, payload);
  assert.equal(result.ok, true, `${name}: ${result.error}`);
  return result;
}
function finishReading() {
  const pending = warmup().pendingAdvance;
  if (pending) mock.timers.tick(Math.max(0, Date.parse(pending.dueAt) - Date.now()) + 1);
}
mock.timers.enable({ apis: ["Date", "setTimeout"], now: new Date(seed.updatedAt) });
try {
  for (const manualMode of [true, false]) {
    const state = structuredClone(initial);
    state.sceneZero.unlock.status = "HUMAN_VERIFICATION";
    state.audienceWarmup.pendingAdvance = { id: "news-test-start", kind: "questions-start", payload: {}, dueAt: new Date(Date.now() - 1).toISOString() };
    assert.equal(showState.restoreFromRecovery({ storeVersion: showState._storeVersion, sessionId: "current-affairs-test", state }).ok, true);
    action("set-manual-mode", { manualMode: true });
    action("primary-next");
    assert.deepEqual(warmup().publishedPromptIds, ["play-dead-30"]);
    showState.completeSceneZeroMessageTyping(showState.snapshot().publicMessage.id);
    action("primary-next"); // Inicia os vinte segundos.
    mock.timers.tick(20000);
    finishReading();
    action("primary-next");
    assert.match(warmup().previewPromptId, /^provocative-/u);
    assert.equal(warmup().publishedPromptIds.length, 2);
    action("repeat");
    assert.equal(warmup().publishedPromptIds.length, 2, "repetição não consome uma pergunta");
    action("skip");
    assert.equal(warmup().previewPrompt.category, "atualidades");
    assert.equal(warmup().publishedPromptIds.length, 2, "prévia/pulo não consome a terceira pergunta");
    action("set-manual-mode", { manualMode });
    action("reaction-many");
    action("surprise");
    finishReading();
    if (manualMode) action("primary-next");
    assert.equal(warmup().sequence.category, "atualidades");
    assert.equal(warmup().publishedPromptIds.length, 3);
    assert.equal(showState.snapshot().publicMessage.content, warmup().preview);
    assert(!JSON.stringify(warmup()).includes("https://"), "fontes ficam fora do snapshot de projeção");
    const published = showState.snapshot().publicMessage.content;
    const saved = structuredClone(showState.privateSnapshot());
    assert.equal(showState.restoreFromRecovery({ storeVersion: showState._storeVersion, sessionId: "current-affairs-test", state: saved }).ok, true);
    action("set-manual-mode", { manualMode: true });
    assert.equal(showState.snapshot().publicMessage.content, published);
    assert.equal(warmup().publishedPromptIds.length, 3, "recuperação mantém a posição");
    action("repeat");
    assert.equal(showState.snapshot().publicMessage.content, published);
    action("reaction-few");
    action("surprise");
    finishReading();
    action("primary-next");
    assert.notEqual(warmup().sequence.category, "atualidades", "quarta pergunta volta ao repertório fixo");
    assert.equal(warmup().publishedPromptIds.length, 4);
    console.log(`PASS ${manualMode ? "manual" : "automatic"}: mortos → sorteada → atualidades → repertório; prévias/repetição/recuperação preservam posição`);
  }
  const manualState = structuredClone(initial);
  manualState.sceneZero.unlock.status = "WARMING_AUDIENCE";
  manualState.audienceWarmup.phase = "questions";
  manualState.audienceWarmup.publishedPromptIds = ["play-dead-30", "provocative-01"];
  assert.equal(showState.restoreFromRecovery({ storeVersion: showState._storeVersion, sessionId: "current-affairs-test", state: manualState }).ok, true);
  action("trigger-prompt", { promptId: "personal-01" });
  assert.equal(warmup().sequence.category, "atualidades", "disparo avulso também respeita a terceira posição");
  action("trigger-preview");
  assert.equal(warmup().publishedPromptIds.length, 3, "repetir a prévia publicada não muda a contagem");
  for (const prompt of [...CURRENT_AFFAIRS_CONTEXT_PROMPTS, ...currentAffairsPrompts(seed)]) {
    action("trigger-prompt", { promptId: prompt.id });
    assert.equal(warmup().sequence.category, "atualidades");
    assert.equal(showState.snapshot().publicMessage.content, prompt.text, "pergunta direta usa o disparo público normal");
    action("reaction-many");
  }

  const legacyState = structuredClone(initial);
  const legacyPrompts = ["play-dead-30", "provocative-01", "provocative-02", "provocative-03"]
    .map((promptId) => AUDIENCE_WARMUP_PROMPTS.find((prompt) => prompt.id === promptId));
  const legacyCurrent = legacyPrompts.at(-1);
  legacyState.sceneZero.unlock.status = "WARMING_AUDIENCE";
  legacyState.audienceWarmup.phase = "questions";
  delete legacyState.audienceWarmup.publishedPromptIds;
  legacyState.audienceWarmup.history = legacyPrompts.map((prompt) => ({ step: 0, text: prompt.text, repeated: false }));
  legacyState.audienceWarmup.recentPromptIds = legacyPrompts.map((prompt) => prompt.id);
  legacyState.audienceWarmup.sequence = createAudienceWarmupSequence({ ...legacyCurrent, promptId: legacyCurrent.id });
  legacyState.audienceWarmup.currentStep = 0;
  assert.equal(showState.restoreFromRecovery({ storeVersion: showState._storeVersion, sessionId: "current-affairs-legacy-test", state: legacyState }).ok, true);
  action("set-manual-mode", { manualMode: true });
  const prematureDraw = showState.controlAudienceWarmup("surprise");
  assert.equal(prematureDraw.ok, false, "atualidades pendentes ainda exigem resposta da pergunta atual");
  assert.match(prematureDraw.error, /REGISTRE A RESPOSTA/u);
  action("reaction-many");
  action("surprise");
  assert.equal(warmup().sequence.promptId, legacyCurrent.id, "reação mantém a pergunta atual até a seta de avanço");
  assert.equal(warmup().pendingAdvance.kind, "draw-and-publish");
  finishReading();
  action("primary-next");
  assert.equal(warmup().sequence.category, "atualidades", "sessão antiga que passou da terceira pergunta recebe atualidades no próximo sorteio");
  assert.equal(warmup().publishedPromptIds.length, 5);
  action("reaction-few");
  action("surprise");
  finishReading();
  action("primary-next");
  assert.notEqual(warmup().sequence.category, "atualidades", "sorteio seguinte volta ao repertório fixo após recuperar atualidades pendentes");
  assert.equal(warmup().publishedPromptIds.length, 6);
  console.log("PASS legacy: sessão recuperada após a terceira pergunta recebe atualidades uma vez pelo fluxo de resposta e reação");

  const oldPrompt = AUDIENCE_WARMUP_PROMPTS.find((prompt) => prompt.id === "provocative-01");
  assert.deepEqual(publishedWarmupPromptIds({ recentPromptIds: [oldPrompt.id], history: [{ step: 0, repeated: false, text: oldPrompt.text }] }, AUDIENCE_WARMUP_PROMPTS), [oldPrompt.id]);
  assert.deepEqual(publishedWarmupPromptIds({ recentPromptIds: [oldPrompt.id], history: [] }, AUDIENCE_WARMUP_PROMPTS), []);
  console.log("PASS weekly: São Paulo midnight, cache, deduplication, retry, validation, fallback and emergency mode");
} finally {
  showState.startNewPresentation();
  await flushSnapshotWrites();
  mock.timers.reset();
  fs.rmSync(directory, { recursive: true, force: true });
}
