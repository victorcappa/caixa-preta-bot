import assert from "node:assert/strict";
import fs from "node:fs";
import { AUDIENCE_WARMUP_ACTIONS, AUDIENCE_WARMUP_PROMPTS } from "../data/audience-warmup-prompts.js";
import { audienceWarmupRequiresCountdown, chooseAudienceWarmupPrompt, clampAudienceWarmupInterval, createAudienceWarmupSequence, inferAudienceWarmupCountdown } from "../lib/audienceWarmup.js";
import { assertBotCannotNavigateExternal, blockedAutonomousInstagramResult } from "../lib/externalNavigationGuard.js";
import { createInitialResearchState, getResearchTools, updateResearchSettings } from "../lib/research/ResearchDirector.js";
import { executeAutonomousInstagramTool } from "../lib/instagram/autonomousTools.js";
import { PLAY_UNLOCK_CONFIG, PLAY_UNLOCK_STATES } from "../data/scene-zero-unlock.js";
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

assert(AUDIENCE_WARMUP_PROMPTS.length >= 30, "a biblioteca deve ter ao menos 30 prompts");
assert.equal(new Set(AUDIENCE_WARMUP_PROMPTS.map((prompt) => prompt.id)).size, AUDIENCE_WARMUP_PROMPTS.length, "ids devem ser únicos");
for (const prompt of AUDIENCE_WARMUP_PROMPTS) {
  assert(prompt.text && prompt.action && prompt.category && prompt.intensity && prompt.tags.length, `metadados incompletos: ${prompt.id}`);
  assert(Number.isFinite(prompt.progressValue), `progresso não configurado: ${prompt.id}`);
  assert.equal(prompt.countdown === 3, /\bquando eu disser três\b/iu.test(prompt.text), `contagem inconsistente: ${prompt.id}`);
}
for (const action of AUDIENCE_WARMUP_ACTIONS) {
  assert(AUDIENCE_WARMUP_PROMPTS.some((prompt) => prompt.action === action.id), `ação sem prompt: ${action.id}`);
  const generated = chooseAudienceWarmupPrompt({ action: action.id, random: () => 0 });
  assert.equal(generated.action, action.id, `geração incompatível: ${action.id}`);
}
assert(AUDIENCE_WARMUP_PROMPTS.some((prompt) => prompt.progressValue === 0), "deve existir ação configurável sem progresso");
assert(AUDIENCE_WARMUP_PROMPTS.some((prompt) => prompt.repeatableProgress), "deve existir ação com progresso repetível");

const wordSequence = createAudienceWarmupSequence({ text: "Quando eu disser três, digam o bairro.", action: "word", countdown: 3 });
assert.equal(wordSequence.requiresCountdown, true);
assert.deepEqual(wordSequence.steps.slice(1, 4).map((step) => step.text), ["Um.", "Dois.", "Três."]);
assert.deepEqual(wordSequence.steps.slice(1, 4).map((step) => step.kind), ["count", "count", "count"]);
assert.deepEqual(createAudienceWarmupSequence({ text: "Quando eu disser cinco, respondam.", action: "word" }).steps.slice(1, 6).map((step) => step.text), ["Um.", "Dois.", "Três.", "Quatro.", "Cinco."]);
assert.deepEqual(createAudienceWarmupSequence({ text: "Vou fazer uma contagem regressiva de 4.", action: "sound" }).steps.slice(1, 5).map((step) => step.text), ["Quatro.", "Três.", "Dois.", "Um."]);
assert.deepEqual(inferAudienceWarmupCountdown("Vou contar de dois até seis.").values, [2, 3, 4, 5, 6]);
assert.deepEqual(inferAudienceWarmupCountdown("Na minha contagem, levantem as mãos.").values, [1, 2, 3]);
const directWordSequence = createAudienceWarmupSequence({ text: "Digam o bairro.", action: "word" });
assert.equal(directWordSequence.requiresCountdown, false);
assert.equal(directWordSequence.steps.some((step) => step.kind === "count"), false, "fala direta não deve ganhar contagem");
assert.equal(audienceWarmupRequiresCountdown({ text: "Quando eu disser 3, respondam." }), true);
assert.equal(audienceWarmupRequiresCountdown({ text: "Digam uma palavra agora." }), false);
assert.equal(audienceWarmupRequiresCountdown({ text: "Respondam sem uma contagem." }), false);
assert(createAudienceWarmupSequence({ text: "Palmas.", action: "clap" }).steps.length >= 3);
assert(createAudienceWarmupSequence({ text: "Mãos.", action: "hand" }).steps.at(-1).text.toLowerCase().includes("abaixar"));
assert(createAudienceWarmupSequence({ text: "Silêncio.", action: "silence" }).steps.length >= 3);
assert.equal(clampAudienceWarmupInterval(10), 800);
assert.equal(clampAudienceWarmupInterval(99999), 15000);

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
assert.equal(PLAY_UNLOCK_CONFIG.unlockLines.includes("PEÇA DESBLOQUEADA"), false);
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
const participantResearchCalls = sceneZeroRoute.match(/researchCurrentSceneZeroParticipant\(\)/g) || [];
assert.equal(participantResearchCalls.length, 2, "pesquisa de participante deve existir apenas na declaração e no handler manual");
assert.match(sceneZeroRoute, /action === "suitcase-research-person"/);
assert.match(sceneZeroRoute, /action === "suitcase-finish"/);
assert.doesNotMatch(sceneZeroRoute, /const researchPromise = researchCurrentSceneZeroParticipant/);

console.log(`audience warmup tests passed (${AUDIENCE_WARMUP_PROMPTS.length} prompts)`);
