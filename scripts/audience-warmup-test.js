import assert from "node:assert/strict";
import fs from "node:fs";
import { AUDIENCE_WARMUP_ACTIONS, AUDIENCE_WARMUP_INTENSITIES, AUDIENCE_WARMUP_INTERACTION_TYPES, AUDIENCE_WARMUP_PROMPTS } from "../data/audience-warmup-prompts.js";
import {
  adjustAudienceWarmupMinigameTime,
  audienceWarmupAutoAdvanceDelay,
  audienceWarmupHasForbiddenLanguage,
  audienceWarmupRequiresCountdown,
  audienceWarmupSurpriseProfile,
  beginAudienceWarmupMinigameRound,
  chooseAudienceWarmupPrompt,
  chooseAudienceWarmupSurprisePrompt,
  clampAudienceWarmupInterval,
  createAudienceWarmupSequence,
  createInitialAudienceWarmupMinigameState,
  inferAudienceWarmupCountdown,
  pauseAudienceWarmupMinigame,
  resumeAudienceWarmupMinigame,
  selectAudienceWarmupMinigame,
  startAudienceWarmupMinigameCountdown
} from "../lib/audienceWarmup.js";
import { AUDIENCE_WARMUP_MINIGAME_INTRO, AUDIENCE_WARMUP_MINIGAMES } from "../data/audience-warmup-minigames.js";
import { assertBotCannotNavigateExternal, blockedAutonomousInstagramResult } from "../lib/externalNavigationGuard.js";
import { createInitialResearchState, getResearchTools, updateResearchSettings } from "../lib/research/ResearchDirector.js";
import { executeAutonomousInstagramTool } from "../lib/instagram/autonomousTools.js";
import { PLAY_UNLOCK_CONFIG, PLAY_UNLOCK_STATES, playUnlockSequenceLines } from "../data/scene-zero-unlock.js";
import {
  adjustPlayUnlockProgress,
  advancePlayUnlockBoot,
  beginPlayUnlockHumanVerification,
  commitPlayUnlockProgress,
  completePlayUnlock,
  createInitialPlayUnlockState,
  preparePlayUnlockProgress,
  readyPlayUnlockAudience,
  recordPlayUnlockAudienceAction,
  startPlayUnlockBoot,
  stallPlayUnlockBoot
} from "../lib/scene-zero/unlock.js";

assert.equal(AUDIENCE_WARMUP_PROMPTS.length, 100, "a biblioteca deve cobrir vinte ações em cada um dos cinco degraus");
assert.equal(new Set(AUDIENCE_WARMUP_PROMPTS.map((prompt) => prompt.id)).size, AUDIENCE_WARMUP_PROMPTS.length, "ids devem ser únicos");
for (const prompt of AUDIENCE_WARMUP_PROMPTS) {
  assert(prompt.text && prompt.action && prompt.category && prompt.intensity && prompt.interactionType && prompt.tags.length, `metadados incompletos: ${prompt.id}`);
  assert(Number.isFinite(prompt.progressValue), `progresso não configurado: ${prompt.id}`);
  const completeText = [prompt.text, ...(prompt.steps || []).map((step) => typeof step === "string" ? step : step.text)].join(" ");
  assert.equal(audienceWarmupHasForbiddenLanguage(completeText), false, `linguagem de pedido proibida: ${prompt.id}`);
  assert.doesNotMatch(completeText, /\b(?:político X|candidato A|um determinado político|uma substância)\b/iu, `placeholder ou suavização proibida: ${prompt.id}`);
  assert.doesNotMatch(completeText, /\b(?:imagine|imaginem|imaginário|imaginária|invisível|apocalipse|cachorro ou gato|mais humano|finjam|como se)\b/iu, `situação fictícia ou pergunta genérica proibida: ${prompt.id}`);
}
assert.equal(AUDIENCE_WARMUP_PROMPTS.some((prompt) => /mora em s[aã]o paulo fica de p[eé]/iu.test(prompt.text)), false);
for (const action of AUDIENCE_WARMUP_ACTIONS) {
  assert(AUDIENCE_WARMUP_PROMPTS.some((prompt) => prompt.action === action.id), `ação sem prompt: ${action.id}`);
  const generated = chooseAudienceWarmupPrompt({ action: action.id, random: () => 0 });
  assert.equal(generated.action, action.id, `geração incompatível: ${action.id}`);
}
assert.deepEqual(AUDIENCE_WARMUP_INTENSITIES.map((intensity) => intensity.id), ["play", "personal", "exposed", "provocative", "social_pressure"]);
for (const intensity of AUDIENCE_WARMUP_INTENSITIES) {
  assert.equal(AUDIENCE_WARMUP_PROMPTS.filter((prompt) => prompt.intensity === intensity.id).length, 20, `degrau sem repertório suficiente: ${intensity.id}`);
}
for (const interactionType of AUDIENCE_WARMUP_INTERACTION_TYPES) {
  assert(AUDIENCE_WARMUP_PROMPTS.some((prompt) => prompt.interactionType === interactionType), `tipo de interação sem prompt: ${interactionType}`);
}
for (const requiredTag of ["política", "sexo", "droga", "dinheiro", "classe", "religião", "relacionamento", "hábito", "vergonha", "culpa"]) {
  assert(AUDIENCE_WARMUP_PROMPTS.some((prompt) => prompt.tags.includes(requiredTag)), `marcador ausente: ${requiredTag}`);
}
assert.deepEqual([1, 6, 7, 12, 13, 18, 19, 24, 25, 30].map((count) => audienceWarmupSurpriseProfile(count).intensity), [
  "play", "play", "personal", "personal", "exposed", "exposed", "provocative", "provocative", "social_pressure", "social_pressure"
]);
for (let count = 1; count <= 30; count += 1) {
  const prompt = chooseAudienceWarmupSurprisePrompt({ count, random: () => 0 });
  assert.equal(prompt.surpriseLevel, Math.min(4, Math.floor((count - 1) / 6)), `surpresa ${count} deve subir sem regressão`);
}

let diversitySeed = 20260910;
const diversityRandom = () => ((diversitySeed = (diversitySeed * 1664525 + 1013904223) >>> 0) / 4294967296);
const recentPromptIds = [];
const thirtyPromptSequence = [];
for (let count = 1; count <= 30; count += 1) {
  const selected = chooseAudienceWarmupSurprisePrompt({ count, recentPromptIds, random: diversityRandom });
  thirtyPromptSequence.push(selected);
  recentPromptIds.push(selected.id);
  if (recentPromptIds.length > 8) recentPromptIds.shift();
}
for (let index = 1; index < thirtyPromptSequence.length; index += 1) {
  const previous = thirtyPromptSequence[index - 1];
  const current = thirtyPromptSequence[index];
  assert.notEqual(current.action, previous.action, `ação principal repetida em ${index + 1}`);
  assert.notEqual(current.interactionType, previous.interactionType, `interactionType repetido em ${index + 1}`);
  assert.notEqual(current.category, previous.category, `categoria repetida em ${index + 1}`);
}

const exactLibraryCases = {
  "public-07": "QUEM VOTOU NO LULA FICA DE PÉ.",
  "exposed-08": "QUEM VOTOU NO BOLSONARO CRUZA OS BRAÇOS.",
  "provocative-01": "QUEM É MACONHEIRO FAZ UMA ONDA COM AS MÃOS.",
  "provocative-07": "QUEM TRANSOU ESTA SEMANA BATE DEZ PALMAS.",
  "provocative-04": "QUEM JÁ CHEIROU COCAÍNA TOCA NO NARIZ."
};
for (const [promptId, expectedText] of Object.entries(exactLibraryCases)) {
  const libraryPrompt = AUDIENCE_WARMUP_PROMPTS.find((prompt) => prompt.id === promptId);
  assert.equal(libraryPrompt.text, expectedText);
  assert.equal(createAudienceWarmupSequence(libraryPrompt).steps[0].text, expectedText, `${promptId} deve chegar intacto à sequência pública`);
}
assert(AUDIENCE_WARMUP_PROMPTS.some((prompt) => prompt.text === "DANCEM MACARENA EM SILÊNCIO."));

const politicalScore = AUDIENCE_WARMUP_PROMPTS.find((prompt) => prompt.id === "social-07");
const politicalSequence = createAudienceWarmupSequence(politicalScore);
assert.deepEqual(politicalSequence.steps.map((step) => step.text), politicalScore.steps.map((step) => step.text), "partitura política deve preservar a dependência entre respostas");
assert.deepEqual(politicalSequence.steps.map((step) => step.action), ["stand", "pose", "hand", "freeze"], "cada passo deve anunciar sua ação visível");
const silentPrompt = AUDIENCE_WARMUP_PROMPTS.find((prompt) => prompt.id === "provocative-03");
assert.deepEqual(createAudienceWarmupSequence(silentPrompt).steps.map((step) => step.text), [silentPrompt.text], "pergunta isolada deve preservar o silêncio posterior");

const wordSequence = createAudienceWarmupSequence({ text: "Quando eu disser três, digam o bairro.", action: "word", countdown: 3 });
assert.equal(wordSequence.requiresCountdown, true);
assert.deepEqual(wordSequence.steps.slice(1, 4).map((step) => step.text), ["Um.", "Dois.", "Três."]);
assert.deepEqual(wordSequence.steps.slice(1, 4).map((step) => step.kind), ["count", "count", "count"]);
assert.deepEqual(createAudienceWarmupSequence({ text: "Quando eu disser cinco, respondam.", action: "word" }).steps.slice(1, 6).map((step) => step.text), ["Um.", "Dois.", "Três.", "Quatro.", "Cinco."]);
assert.deepEqual(createAudienceWarmupSequence({ text: "Vou fazer uma contagem regressiva de 4.", action: "sound" }).steps.slice(1, 5).map((step) => step.text), ["Quatro.", "Três.", "Dois.", "Um."]);
assert.deepEqual(inferAudienceWarmupCountdown("Vou contar de dois até seis.").values, [2, 3, 4, 5, 6]);
assert.deepEqual(inferAudienceWarmupCountdown("Na minha contagem, levantem as mãos.").values, [1, 2, 3]);
const timedContactSequence = createAudienceWarmupSequence({
  text: "Virem-se de lado devagar e encostem a cabeça no ombro da pessoa à direita por cinco segundos.",
  action: "touch"
});
assert.deepEqual(timedContactSequence.steps.slice(1, 6).map((step) => step.text), ["Cinco.", "Quatro.", "Três.", "Dois.", "Um."]);
assert.equal(timedContactSequence.steps[6].kind, "reaction");
assert.equal(audienceWarmupAutoAdvanceDelay({ sequence: timedContactSequence, stepIndex: 1, intervalMs: 2500 }), 1000);
assert.deepEqual(inferAudienceWarmupCountdown("Mantenham a posição durante 10 segundos.").values, [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
assert.deepEqual(inferAudienceWarmupCountdown("Façam isso em 3 segundos.").values, [3, 2, 1]);
const directWordSequence = createAudienceWarmupSequence({ text: "Digam o bairro.", action: "chorus" });
assert.equal(directWordSequence.requiresCountdown, false);
assert.equal(directWordSequence.steps.some((step) => step.kind === "count"), false, "fala direta não deve ganhar contagem");
assert.equal(audienceWarmupRequiresCountdown({ text: "Quando eu disser 3, respondam." }), true);
assert.equal(audienceWarmupRequiresCountdown({ text: "Digam uma palavra agora." }), false);
assert.equal(audienceWarmupRequiresCountdown({ text: "Respondam sem uma contagem." }), false);
assert.deepEqual(createAudienceWarmupSequence({ text: "Palmas.", action: "clap" }).steps.map((step) => step.text), ["Palmas.", "RESPOSTA SONORA REGISTRADA."]);
assert.equal(createAudienceWarmupSequence({ text: "Mãos.", action: "hand" }).steps.at(-1).text, "ABAIXEM.");
assert.deepEqual(createAudienceWarmupSequence({ text: "Olhem.", action: "look" }).steps.map((step) => step.text), ["Olhem.", "VÍNCULO VISUAL REGISTRADO."]);
assert.equal(clampAudienceWarmupInterval(10), 800);
assert.equal(clampAudienceWarmupInterval(99999), 15000);

assert.deepEqual(AUDIENCE_WARMUP_MINIGAMES.map((game) => game.name), ["TAPÃO", "PISCADA", "SERINHO"]);
assert.deepEqual(AUDIENCE_WARMUP_MINIGAME_INTRO, ["ANTES DAS PERGUNTAS, UM TESTE.", "FORMEM DUPLAS.", "UM JOGO SERÁ SORTEADO.", "SIGAM AS INSTRUÇÕES."]);
assert.doesNotMatch(AUDIENCE_WARMUP_MINIGAME_INTRO.join(" "), /NÃO COMPLIQUEM/);
for (const instruction of [...AUDIENCE_WARMUP_MINIGAME_INTRO, ...AUDIENCE_WARMUP_MINIGAMES.flatMap((game) => game.rules)]) {
  assert.equal(audienceWarmupHasForbiddenLanguage(instruction), false, `linguagem de pedido proibida no minigame: ${instruction}`);
}
let minigame = createInitialAudienceWarmupMinigameState("2026-09-09T00:00:00.000Z");
let minigameResult = selectAudienceWarmupMinigame(minigame, "tapao", { now: "2026-09-09T00:00:01.000Z" });
assert.equal(minigameResult.applied, true);
minigame = { ...minigameResult.state, status: "ready", round: 1 };
minigameResult = startAudienceWarmupMinigameCountdown(minigame, "2026-09-09T00:00:02.000Z");
assert.equal(minigameResult.state.timer.durationSeconds, 3);
minigameResult.state.durations.tapao = 60;
minigameResult = beginAudienceWarmupMinigameRound(minigameResult.state, "2026-09-09T00:00:05.000Z");
assert.equal(minigameResult.state.timer.durationSeconds, 10, "cada turno do TAPÃO deve começar fixado em dez segundos");
minigameResult = pauseAudienceWarmupMinigame(minigameResult.state, "2026-09-09T00:00:09.000Z");
assert.equal(minigameResult.state.timer.remainingSeconds, 6);
minigameResult = adjustAudienceWarmupMinigameTime(minigameResult.state, 5, "2026-09-09T00:00:09.000Z");
assert.equal(minigameResult.state.timer.remainingSeconds, 11);
minigameResult = resumeAudienceWarmupMinigame(minigameResult.state, "2026-09-09T00:00:10.000Z");
assert.equal(minigameResult.state.status, "running");
assert.equal(selectAudienceWarmupMinigame(minigameResult.state, "serinho").reason, "MINIGAME_ALREADY_STARTED", "um jogo iniciado não pode ser substituído por outro");
assert.equal(selectAudienceWarmupMinigame({ ...minigameResult.state, status: "completed" }, "serinho").reason, "MINIGAME_ALREADY_STARTED", "perguntas não podem voltar ao bloco de minigame");

let unlock = createInitialPlayUnlockState("2026-09-09T00:00:00.000Z");
assert.equal(unlock.status, PLAY_UNLOCK_STATES.STANDBY);
assert.equal(unlock.progress, 0);
assert.equal(unlock.startedAt, null);
unlock = startPlayUnlockBoot(unlock, "2026-09-09T00:00:01.000Z");
assert.equal(unlock.status, PLAY_UNLOCK_STATES.BOOTING);
for (const expectedStep of PLAY_UNLOCK_CONFIG.bootSteps) {
  const advanced = advancePlayUnlockBoot(unlock);
  assert.equal(advanced.step.id, expectedStep.id);
  unlock = advanced.state;
}
unlock = stallPlayUnlockBoot(unlock);
assert.equal(unlock.status, PLAY_UNLOCK_STATES.BOOT_FAILED);
assert.equal(unlock.progress, 78);
assert.equal(PLAY_UNLOCK_CONFIG.verificationTitle, "... PROVE QUE VOCÊ É HUMANO");
assert.equal(PLAY_UNLOCK_CONFIG.unlockLines.includes("PEÇA DESBLOQUEADA."), true);
assert.equal(PLAY_UNLOCK_CONFIG.unlockLines.includes("HUMANIDADE SUFICIENTE."), true);
assert.deepEqual(playUnlockSequenceLines("suitcases-finished"), ["FIM DO TUTORIAL"]);
assert.equal(playUnlockSequenceLines("progress").includes("FIM DO TUTORIAL"), false);
unlock = beginPlayUnlockHumanVerification(unlock, "2026-09-09T00:00:20.000Z");
assert.equal(unlock.status, PLAY_UNLOCK_STATES.HUMAN_VERIFICATION);
assert.equal(unlock.verificationTitleSequence, 1);
unlock = readyPlayUnlockAudience(unlock, "2026-09-09T00:00:24.000Z");
assert.equal(unlock.status, PLAY_UNLOCK_STATES.WAITING_FOR_AUDIENCE);
assert.equal(unlock.progress, PLAY_UNLOCK_CONFIG.bootLimit);

const firstAction = recordPlayUnlockAudienceAction(unlock, { label: "Palmas", progressId: "clap-once", progressValue: 4, externalInput: { sequenceId: "warmup-1" } });
assert.equal(firstAction.applied, true);
assert.equal(firstAction.state.progress, PLAY_UNLOCK_CONFIG.bootLimit, "projetar a ação ainda não avalia o resultado");
assert.equal(firstAction.state.status, PLAY_UNLOCK_STATES.WARMING_AUDIENCE);
const repeatedAction = recordPlayUnlockAudienceAction(firstAction.state, { label: "Palmas de novo", progressId: "clap-once", progressValue: 4, externalInput: { sequenceId: "warmup-2" } });
assert.equal(repeatedAction.applied, true);
assert.equal(repeatedAction.state.progress, PLAY_UNLOCK_CONFIG.bootLimit, "repetir a fala sem avaliação não deve alterar a barra");
const increased = adjustPlayUnlockProgress(repeatedAction.state, 2, { label: "ação funcionou" });
assert.equal(increased.applied, true);
assert.equal(increased.state.progress, 80);
assert.equal(increased.state.lastIncreaseAction, "ação funcionou");
assert.equal(adjustPlayUnlockProgress(increased.state, -2).reason, "ACTION_ALREADY_EVALUATED", "cada ação aceita somente uma avaliação");
const nextAction = recordPlayUnlockAudienceAction(increased.state, { label: "Silêncio", progressId: "silence-once", progressValue: 2, externalInput: { sequenceId: "warmup-3" } });
const decreased = adjustPlayUnlockProgress(nextAction.state, -2, { label: "ação falhou" });
assert.equal(decreased.state.progress, 78);
assert.equal(decreased.state.lastIncreaseAction, "ação funcionou", "redução não substitui a última ação que aumentou");
const almostComplete = recordPlayUnlockAudienceAction({ ...decreased.state, progress: 98 }, { label: "Coro", progressId: "choir-once", progressValue: 10, externalInput: { sequenceId: "warmup-4" } });
const capped = adjustPlayUnlockProgress(almostComplete.state, 10, { label: "quase completo" });
assert.equal(capped.state.progress, 100, "ações físicas podem concluir a verificação");
const queuedAction = recordPlayUnlockAudienceAction({ ...decreased.state, progress: 80 }, { label: "Som", progressId: "sound-once", progressValue: 7, externalInput: { sequenceId: "warmup-5" } });
const prepared = preparePlayUnlockProgress(queuedAction.state, 7, { now: "2026-09-09T00:00:30.000Z" });
assert.equal(prepared.state.progress, 80, "o feedback técnico deve preceder a atualização da barra");
assert.match(prepared.state.technicalFeedback, /DETECTADA|RECEBIDA|REGISTRADO|ACEITÁVEL|AUMENTANDO|COMPATÍVEL|VÁLIDA|PROVÁVEL|ACEITA|ANDAMENTO/);
const committed = commitPlayUnlockProgress(prepared.state, "2026-09-09T00:00:31.000Z");
assert.equal(committed.state.progress, 87);
const completed = completePlayUnlock(capped.state, { source: "suitcases-finished" });
assert.equal(completed.status, PLAY_UNLOCK_STATES.UNLOCKED);
assert.equal(completed.progress, 100);
assert.equal(completed.onPlayUnlocked.name, "onPlayUnlocked");
assert.equal(completed.onPlayUnlocked.source, "suitcases-finished");
assert.equal(createInitialPlayUnlockState().scoredActionIds.length, 0, "reinício deve limpar ações contabilizadas");

assert.throws(
  () => assertBotCannotNavigateExternal({ source: "agent", target: "https://instagram.com/test" }),
  /BOT_EXTERNAL_NAVIGATION_BLOCKED/
);
assert.doesNotThrow(() => assertBotCannotNavigateExternal({ source: "operator", target: "https://instagram.com/test" }));
assert.equal(blockedAutonomousInstagramResult().code, "BOT_EXTERNAL_NAVIGATION_BLOCKED");
assert.equal((await executeAutonomousInstagramTool({ name: "instagram_open_profile", args: { username: "test" } })).code, "BOT_EXTERNAL_NAVIGATION_BLOCKED");

const research = updateResearchSettings(createInitialResearchState(), { autonomousInstagramEnabled: true });
assert.equal(research.autonomousInstagramEnabled, false, "o modelo não pode reativar Instagram autônomo");
assert.equal(getResearchTools({ research }).some((tool) => tool.name.startsWith("instagram_")), false);

const sceneZeroRoute = fs.readFileSync(new URL("../app/api/scene-zero/route.js", import.meta.url), "utf8");
const audienceWarmupRoute = fs.readFileSync(new URL("../app/api/audience-warmup/route.js", import.meta.url), "utf8");
const showStateSource = fs.readFileSync(new URL("../lib/showState.js", import.meta.url), "utf8");
const sceneZeroProjection = fs.readFileSync(new URL("../components/SceneZeroProjectionLayer.js", import.meta.url), "utf8");
const participantResearchCalls = sceneZeroRoute.match(/researchCurrentSceneZeroParticipant\(\)/g) || [];
assert.equal(participantResearchCalls.length, 2, "pesquisa de participante deve existir apenas na declaração e no handler manual");
assert.match(sceneZeroRoute, /action === "suitcase-research-person"/);
assert.match(sceneZeroRoute, /action === "suitcase-finish"/);
assert.doesNotMatch(sceneZeroRoute, /const researchPromise = researchCurrentSceneZeroParticipant/);
assert.match(audienceWarmupRoute, /body\.action === "unlock-boot"[\s\S]*refreshSceneZeroLocalContext\(\)/, "BOOT deve colher contexto atual");
assert.doesNotMatch(audienceWarmupRoute, /generateAudienceWarmupSurprise/, "a biblioteca configurada deve ser a fonte de verdade do SURPREENDA-ME");
assert.match(showStateSource, /step\.kind === "count" && nextStep\?\.kind === "reaction"/, "último segundo deve avançar automaticamente para a reação");
assert.match(showStateSource, /action === "minigame-draw"/);
assert.match(showStateSource, /action === "minigame-tapao-swap"/);
assert.match(sceneZeroProjection, /SORTEANDO TESTE/);
assert.doesNotMatch(sceneZeroProjection, />10 SEGUNDOS</, "contagem do participante não deve repetir a duração por escrito");
assert.match(sceneZeroProjection, /suitcaseCueFrame\.phase === "reveal" \? "MALA"/, "revelação deve mostrar MALA acima do número");
assert.match(sceneZeroProjection, /allVisibleMorelLines\.slice\(-10\)/, "BIOS final deve acompanhar as linhas mais recentes");
assert.match(sceneZeroProjection, /hangman\.status === "won"\) robotSoundEngine\.success\(\)/, "vitória da forca deve disparar som de sucesso");
assert.match(sceneZeroProjection, /else robotSoundEngine\.error\(\)/, "derrota da forca deve disparar som de erro");
assert.match(sceneZeroRoute, /O jogo é simples:[\s\S]*Vou escolher uma mala aleatoriamente\./, "primeira mala deve ser precedida de explicação e anúncio");
assert.match(sceneZeroRoute, /scheduleHangmanStart[\s\S]*controlSceneZero\("hangman-start"/, "a forca deve iniciar automaticamente");
assert.match(sceneZeroRoute, /FIM DO TUTORIAL|tutorialCompleteDurationMs/, "a Mala 1 deve terminar o tutorial antes do glitch");

console.log(`audience warmup tests passed (${AUDIENCE_WARMUP_PROMPTS.length} prompts)`);
