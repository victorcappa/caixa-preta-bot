import assert from "node:assert/strict";
import fs from "node:fs";
import { AUDIENCE_WARMUP_ACTIONS, AUDIENCE_WARMUP_PROMPTS } from "../data/audience-warmup-prompts.js";
import { audienceWarmupRequiresCountdown, chooseAudienceWarmupPrompt, clampAudienceWarmupInterval, createAudienceWarmupSequence, inferAudienceWarmupCountdown } from "../lib/audienceWarmup.js";
import { assertBotCannotNavigateExternal, blockedAutonomousInstagramResult } from "../lib/externalNavigationGuard.js";
import { createInitialResearchState, getResearchTools, updateResearchSettings } from "../lib/research/ResearchDirector.js";
import { executeAutonomousInstagramTool } from "../lib/instagram/autonomousTools.js";

assert(AUDIENCE_WARMUP_PROMPTS.length >= 30, "a biblioteca deve ter ao menos 30 prompts");
assert.equal(new Set(AUDIENCE_WARMUP_PROMPTS.map((prompt) => prompt.id)).size, AUDIENCE_WARMUP_PROMPTS.length, "ids devem ser únicos");
for (const prompt of AUDIENCE_WARMUP_PROMPTS) {
  assert(prompt.text && prompt.action && prompt.category && prompt.intensity && prompt.tags.length, `metadados incompletos: ${prompt.id}`);
  assert.equal(prompt.countdown === 3, /\bquando eu disser três\b/iu.test(prompt.text), `contagem inconsistente: ${prompt.id}`);
}
for (const action of AUDIENCE_WARMUP_ACTIONS) {
  assert(AUDIENCE_WARMUP_PROMPTS.some((prompt) => prompt.action === action.id), `ação sem prompt: ${action.id}`);
  const generated = chooseAudienceWarmupPrompt({ action: action.id, random: () => 0 });
  assert.equal(generated.action, action.id, `geração incompatível: ${action.id}`);
}

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
assert.doesNotMatch(sceneZeroRoute, /const researchPromise = researchCurrentSceneZeroParticipant/);

console.log(`audience warmup tests passed (${AUDIENCE_WARMUP_PROMPTS.length} prompts)`);
