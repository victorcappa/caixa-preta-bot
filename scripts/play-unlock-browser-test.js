import assert from "node:assert/strict";
import { chromium } from "playwright";
import { AUDIENCE_WARMUP_PROMPTS } from "../data/audience-warmup-prompts.js";
import { PLAY_UNLOCK_CONFIG } from "../data/scene-zero-unlock.js";

const BASE_URL = process.env.CAIXA_PRETA_URL || "http://localhost:3000";

async function state(request) {
  return (await request.get(`${BASE_URL}/api/state`)).json();
}

async function unlock(request, action, payload = {}) {
  const response = await request.post(`${BASE_URL}/api/audience-warmup`, {
    data: { action: `unlock-${action}`, ...payload }
  });
  const data = await response.json();
  assert.equal(response.ok(), true, `${action}: ${data.error || "request failed"}`);
  return data.unlock;
}

async function waitForUnlock(request, predicate, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await state(request);
    if (predicate(snapshot.sceneZero.unlock)) return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error("timeout waiting for unlock state");
}

async function waitForState(request, predicate, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await state(request);
    if (predicate(snapshot)) return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error("timeout waiting for application state");
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addInitScript(() => {
  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices) return;
  mediaDevices.getUserMedia = async () => {
    const count = Number(window.localStorage.getItem("caixa-preta-test-get-user-media-count") || 0) + 1;
    window.localStorage.setItem("caixa-preta-test-get-user-media-count", `${count}`);
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const destination = audioContext.createMediaStreamDestination();
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start();
    window.__caixaPretaTestMicrophones = [...(window.__caixaPretaTestMicrophones || []), { audioContext, gain, oscillator }];
    return destination.stream;
  };
});

try {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } });

  const display = await context.newPage();
  await display.setViewportSize({ width: 1920, height: 1080 });
  await display.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await display.waitForFunction(() => document.querySelector('[aria-label="Chat publico"]'));
  await new Promise((resolve) => setTimeout(resolve, 4500));

  let snapshot = await state(context.request);
  assert.equal(snapshot.sceneZero.unlock.status, "STANDBY");
  assert.equal(snapshot.sceneZero.unlock.bootProgress, 0);
  assert.equal(snapshot.sceneZero.unlock.progress, 0);
  assert.equal((await display.locator("body").innerText()).trim(), ">", "a projeção deve mostrar um único cursor antes do BOOT");
  assert.equal(await display.getByText("TEM ALGUEM AI?", { exact: false }).count(), 0);
  assert.equal(await display.getByLabel("BIOS da Cena 0").count(), 0);
  await display.screenshot({ path: "/private/tmp/caixa-preta-standby-black.png" });

  const operator = await context.newPage();
  await operator.setViewportSize({ width: 1440, height: 1100 });
  await operator.goto(`${BASE_URL}/cena-0-controller`, { waitUntil: "domcontentloaded" });
  await operator.waitForFunction(() => window.localStorage.getItem("caixa-preta-test-get-user-media-count") === "1");
  const bootPanel = operator.getByRole("region", { name: "Boot da Cena 0" });
  const bootButton = bootPanel.getByRole("button", { name: "BOOT", exact: true });
  const restartButton = bootPanel.getByRole("button", { name: "REINICIAR", exact: true });
  await bootButton.waitFor();
  await restartButton.waitFor();
  const bootBox = await bootButton.boundingBox();
  const restartBox = await restartButton.boundingBox();
  assert(Math.abs(bootBox.y - restartBox.y) < 2, "BOOT e REINICIAR devem ficar lado a lado");
  assert.equal(await bootPanel.evaluate((element) => element.nextElementSibling?.id), "scene-zero-unlock", "BOOT deve ser o primeiro bloco da Cena 0");
  const warmupDisclosure = operator.locator("#scene-zero-unlock");
  await operator.waitForFunction(() => document.querySelector("#scene-zero-unlock")?.dataset.ready === "true");
  const warmupToggle = warmupDisclosure.getByRole("button", { name: /ESQUENTAR PÚBLICO/ });
  assert.equal(await warmupToggle.getAttribute("aria-expanded"), "false", "aquecimento deve iniciar comprimido");
  assert.equal(await warmupDisclosure.evaluate((element) => element.nextElementSibling?.id), "scene-zero-participant");
  const participantBlock = operator.locator("#scene-zero-participant");
  await participantBlock.getByRole("heading", { name: "ESCOLHER PARTICIPANTE" }).waitFor();
  assert.equal(await participantBlock.evaluate((element) => element.nextElementSibling?.id), "scene-zero-suitcases");
  await operator.getByRole("heading", { name: "JOGO DAS MALAS" }).waitFor();
  const suitcaseOne = operator.getByRole("heading", { name: "MALA 1 / FIM DO TUTORIAL" }).locator("..");
  const reloadMorelBios = suitcaseOne.getByRole("button", { name: "RECARREGAR GLITCH + BIOS", exact: true });
  assert.equal(await reloadMorelBios.isVisible(), false, "detalhes das malas devem iniciar comprimidos");
  await suitcaseOne.getByRole("button", { name: "CONTROLES", exact: true }).click();
  await reloadMorelBios.waitFor();
  await suitcaseOne.getByRole("button", { name: "COMPRIMIR", exact: true }).click();
  const extrasToggle = operator.locator("#scene-zero-extras").getByRole("button", { name: /OUTROS CONTROLES/ });
  assert.equal(await extrasToggle.getAttribute("aria-expanded"), "false", "controles secundários devem iniciar ocultos");
  assert.equal(await operator.getByRole("heading", { name: "MEMÓRIA DA SESSÃO" }).count(), 0);
  await extrasToggle.click();
  await operator.getByRole("heading", { name: "MEMÓRIA DA SESSÃO" }).waitFor();
  await extrasToggle.click();
  assert.equal(await operator.getByRole("heading", { name: "MEMÓRIA DA SESSÃO" }).count(), 0);
  await operator.screenshot({ path: "/private/tmp/caixa-preta-controller-maletas-collapsed.png" });
  await warmupToggle.click();
  await operator.waitForFunction(() => document.querySelector("#scene-zero-unlock button")?.getAttribute("aria-expanded") === "true");
  await warmupToggle.click();
  await operator.waitForFunction(() => document.querySelector("#scene-zero-unlock button")?.getAttribute("aria-expanded") === "false");
  await warmupToggle.click();
  await operator.waitForFunction(() => document.querySelector("#scene-zero-unlock button")?.getAttribute("aria-expanded") === "true");
  const unlockPanel = operator.getByLabel("Desbloqueio da peça");
  await unlockPanel.waitFor();
  assert.equal(await unlockPanel.getByRole("button", { name: "BOOT", exact: true }).count(), 0, "BOOT deve permanecer apenas no painel principal");
  await bootButton.click();
  snapshot = await waitForUnlock(context.request, (value) => value.status === "BOOTING");
  await restartButton.click();
  snapshot = await waitForUnlock(context.request, (value) => value.status === "STANDBY");
  assert.equal(snapshot.sceneZero.unlock.progress, 0);
  await display.waitForFunction(() => document.body.innerText.trim() === ">");
  assert.equal((await display.locator("body").innerText()).trim(), ">", "REINICIAR deve devolver a projeção ao cursor inicial");
  await new Promise((resolve) => setTimeout(resolve, 750));
  snapshot = await state(context.request);
  assert.equal(snapshot.sceneZero.unlock.status, "STANDBY", "a rotina da BIOS deve permanecer cancelada após REINICIAR");

  await bootButton.click();
  snapshot = await waitForUnlock(context.request, (value) => value.status === "BOOTING");

  await unlock(context.request, "pause-boot");
  snapshot = await state(context.request);
  const pausedProgress = snapshot.sceneZero.unlock.bootProgress;
  assert.equal(snapshot.sceneZero.unlock.bootPaused, true);
  await new Promise((resolve) => setTimeout(resolve, 750));
  snapshot = await state(context.request);
  assert.equal(snapshot.sceneZero.unlock.bootProgress, pausedProgress, "BIOS pausada não deve avançar sozinha");

  for (let index = 0; index < 12 && snapshot.sceneZero.unlock.status === "BOOTING"; index += 1) {
    await unlock(context.request, "advance-boot");
    snapshot = await state(context.request);
  }
  assert.equal(snapshot.sceneZero.unlock.status, "BOOT_FAILED");
  assert.equal(snapshot.sceneZero.unlock.bootProgress, PLAY_UNLOCK_CONFIG.bootStallProgress);
  assert.equal(snapshot.sceneZero.unlock.bootComplete, false);
  assert.equal(snapshot.sceneZero.unlock.progress, 0);
  assert.equal(snapshot.publicMessage, null, "o erro da BIOS não deve criar fala do chatbot");
  await display.getByLabel("BIOS da Cena 0").waitFor();
  await display.getByText("AÇÃO COLETIVA", { exact: true }).waitFor();
  await new Promise((resolve) => setTimeout(resolve, 800));
  await display.screenshot({ path: "/private/tmp/caixa-preta-bios-stalled.png" });
  await new Promise((resolve) => setTimeout(resolve, PLAY_UNLOCK_CONFIG.bootFailureDurationMs + 400));
  await display.getByLabel("BIOS da Cena 0").waitFor();
  snapshot = await state(context.request);
  assert.equal(snapshot.sceneZero.unlock.status, "BOOT_FAILED", "aquecimento não deve começar automaticamente");
  assert.equal(snapshot.publicMessage, null);
  await display.getByRole("progressbar", { name: `CARREGAMENTO DA BIOS: ${PLAY_UNLOCK_CONFIG.bootStallProgress}%` }).waitFor();

  const endBiosButton = unlockPanel.getByRole("button", { name: "ENCERRAR BIOS", exact: true });
  await endBiosButton.click();
  snapshot = await waitForUnlock(context.request, (value) => value.status === "SOUND_CHECK" && value.bootComplete);
  assert.equal(snapshot.sceneZero.unlock.bootProgress, 100, "ENCERRAR BIOS deve completar a barra antes da próxima etapa");
  await display.getByRole("progressbar", { name: "CARREGAMENTO DA BIOS: 100%" }).waitFor();
  await display.getByLabel("Verificação sonora da plateia").waitFor({ timeout: 7000 });
  snapshot = await state(context.request);
  assert.equal(snapshot.sceneZero.unlock.status, "SOUND_CHECK");
  assert.equal(snapshot.sceneZero.unlock.soundCheck.phase, "greeting");
  const greetingMessage = display.getByText("Olá, mundo...", { exact: true });
  await greetingMessage.waitFor();
  assert.equal(await greetingMessage.evaluate((element) => getComputedStyle(element).color), "rgb(0, 255, 102)");
  const questionMessage = display.getByText("Tem alguém aí?", { exact: true });
  await questionMessage.waitFor({ timeout: 7000 });
  assert.equal(await questionMessage.evaluate((element) => getComputedStyle(element).color), "rgb(0, 255, 102)");
  await display.getByRole("progressbar", { name: /Nível sonoro:/ }).waitFor();
  assert.equal(
    await display.evaluate(() => window.localStorage.getItem("caixa-preta-test-get-user-media-count")),
    "1",
    "a prova sonora não pode solicitar o microfone novamente na projeção"
  );
  const goodEveningMessage = display.getByText("Boa noite...", { exact: true });
  await goodEveningMessage.waitFor({ timeout: 7000 });
  assert.equal(await goodEveningMessage.evaluate((element) => getComputedStyle(element).color), "rgb(0, 255, 102)");
  await operator.evaluate(async () => {
    const microphone = window.__caixaPretaTestMicrophones?.[0];
    await microphone?.audioContext.resume();
    await window.__caixaPretaControllerMicrophone?.context?.resume();
    if (microphone?.gain) microphone.gain.gain.value = 0.25;
  });
  await waitForUnlock(context.request, (value) => Number(value.soundCheck?.liveLevel) >= PLAY_UNLOCK_CONFIG.soundCheck.thresholdPercent, 7000);
  await display.screenshot({ path: "/private/tmp/caixa-preta-sound-check-listening.png" });
  snapshot = await waitForUnlock(context.request, (value) => value.status === "SOUND_CHECK" && value.soundCheck?.phase === "confirmed");
  await operator.evaluate(() => {
    const microphone = window.__caixaPretaTestMicrophones?.[0];
    if (microphone?.gain) microphone.gain.gain.value = 0;
  });
  assert(PLAY_UNLOCK_CONFIG.soundCheck.comments.includes(snapshot.sceneZero.unlock.soundCheck.comment));
  assert.equal(snapshot.sceneZero.unlock.progress, PLAY_UNLOCK_CONFIG.soundCheck.progressValue);
  await display.getByText(snapshot.sceneZero.unlock.soundCheck.comment, { exact: true }).waitFor();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await display.screenshot({ path: "/private/tmp/caixa-preta-sound-check-confirmed.png" });
  await display.getByLabel("Protocolo de verificação humana").waitFor({ timeout: 7000 });
  snapshot = await state(context.request);
  assert.equal(snapshot.sceneZero.unlock.status, "HUMAN_VERIFICATION");
  assert.equal(snapshot.publicMessage.content, PLAY_UNLOCK_CONFIG.questionsIntroduction, "o bot deve apresentar a série de perguntas depois dos decibéis");
  await display.getByText(PLAY_UNLOCK_CONFIG.questionsIntroduction, { exact: true }).waitFor();
  await new Promise((resolve) => setTimeout(resolve, 900));
  await display.screenshot({ path: "/private/tmp/caixa-preta-human-verification-title.png" });

  snapshot = await waitForState(context.request, (value) => value.audienceWarmup.phase === "questions", 7000);
  const initialWarmupProgress = PLAY_UNLOCK_CONFIG.soundCheck.progressValue + PLAY_UNLOCK_CONFIG.questionProgressValue;
  assert.equal(snapshot.sceneZero.unlock.progress, initialWarmupProgress);
  assert.equal(snapshot.sceneZero.unlock.verificationTitleSequence, 1);
  assert.equal(snapshot.audienceWarmup.phase, "questions");
  assert.equal(snapshot.audienceWarmup.previewPromptId, "play-dead-30");
  const compactProgress = display.getByRole("complementary", { name: "Progresso" });
  await compactProgress.waitFor();
  await compactProgress.getByText("DESBLOQUEIO DO ESPETÁCULO", { exact: true }).waitFor();
  await compactProgress.getByText(`${initialWarmupProgress}%`, { exact: true }).waitFor();
  await display.getByText(snapshot.publicMessage.content, { exact: true }).waitFor();
  const firstLibraryPrompt = AUDIENCE_WARMUP_PROMPTS.find((prompt) => prompt.id === snapshot.audienceWarmup.previewPromptId);
  assert(firstLibraryPrompt);
  await display.getByText(firstLibraryPrompt.text, { exact: true }).waitFor();

  assert(snapshot.sceneZero.unlock.scoredActionIds.includes(firstLibraryPrompt.id));

  const manualText = "FAÇAM UMA ONDA DA ESQUERDA PARA A DIREITA.";
  const warmupResponse = await context.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action: "send", text: manualText } });
  assert.equal(warmupResponse.ok(), true);
  snapshot = await waitForUnlock(context.request, (value) => value.progress === initialWarmupProgress + PLAY_UNLOCK_CONFIG.questionProgressValue);

  const finishQuestions = await context.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action: "questions-complete" } });
  assert.equal(finishQuestions.ok(), true);
  snapshot = await waitForState(context.request, (value) => value.audienceWarmup.phase === "minigame" && value.audienceWarmup.minigame.status === "ready_for_draw", 20000);
  const skipMinigame = await context.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action: "minigame-skip" } });
  assert.equal(skipMinigame.ok(), true);
  snapshot = await waitForState(context.request, (value) => value.audienceWarmup.phase === "complete", 12000);

  await unlock(context.request, "set-progress", { progress: 84 });
  snapshot = await waitForUnlock(context.request, (value) => value.progress === 84);
  await unlock(context.request, "increase-participation", { amount: 2 });
  snapshot = await waitForUnlock(context.request, (value) => value.progress === 86 && !value.pendingProgress);
  await unlock(context.request, "decrease-participation", { amount: 2 });
  snapshot = await waitForUnlock(context.request, (value) => value.progress === 84 && !value.pendingProgress);

  assert.equal(await unlockPanel.getByRole("button", { name: "LEVAR ATÉ 99%", exact: true }).count(), 1);
  const finalUnlockButton = unlockPanel.getByRole("button", { name: "RETOMAR 100% APÓS ÚLTIMA MALA", exact: true });
  assert.equal(await finalUnlockButton.count(), 1);
  assert.equal(await finalUnlockButton.isDisabled(), true, "100% deve ficar bloqueado antes da última mala");

  const soundToggle = operator.getByLabel("ÁUDIO BIOS / UNLOCK");
  await soundToggle.click();
  snapshot = await waitForUnlock(context.request, (value) => value.soundEnabled === false);
  assert.equal(snapshot.sceneZero.unlock.soundEnabled, false);

  await unlockPanel.getByRole("button", { name: "LEVAR ATÉ 99%", exact: true }).click();
  snapshot = await waitForUnlock(context.request, (value) => value.progress > 84 && value.progress < 99);
  assert.equal(snapshot.sceneZero.unlock.animation.kind, "complete", "a preparação deve animar a partir do percentual atual");
  snapshot = await waitForUnlock(context.request, (value) => value.progress === 99 && !value.animation);
  assert.equal(snapshot.sceneZero.unlock.status, "WARMING_AUDIENCE");
  assert.equal(snapshot.sceneZero.unlock.onPlayUnlocked, null);
  await compactProgress.getByText("99%", { exact: true }).waitFor();
  await display.screenshot({ path: "/private/tmp/caixa-preta-play-unlock-99.png" });

  await operator.getByRole("button", { name: "REINICIAR DESBLOQUEIO" }).click();
  snapshot = await waitForUnlock(context.request, (value) => value.status === "STANDBY");
  assert.equal(snapshot.sceneZero.unlock.progress, 0);
  await bootButton.waitFor();

  await bootButton.click();
  snapshot = await waitForUnlock(context.request, (value) => value.status === "BOOTING");
  for (let index = 0; index < 12 && snapshot.sceneZero.unlock.status === "BOOTING"; index += 1) {
    await unlock(context.request, "advance-boot");
    snapshot = await state(context.request);
  }
  const manualMode = operator.getByRole("region", { name: "Controles iniciais do aquecimento" }).getByRole("checkbox");
  await manualMode.click();
  snapshot = await waitForState(context.request, (value) => value.audienceWarmup.manualMode === true);
  await unlock(context.request, "end-bios");
  snapshot = await waitForUnlock(context.request, (value) => value.status === "SOUND_CHECK" && value.soundCheck?.phase === "greeting", 7000);
  await new Promise((resolve) => setTimeout(resolve, PLAY_UNLOCK_CONFIG.soundCheck.greetingDurationMs + 500));
  snapshot = await state(context.request);
  assert.equal(snapshot.sceneZero.unlock.soundCheck.phase, "greeting", "modo manual não pode ativar o medidor sozinho");
  assert.equal(snapshot.audienceWarmup.pendingAdvance.kind, "sound-check-listen");
  await operator.keyboard.press("ArrowRight");
  snapshot = await waitForState(context.request, (value) => (
    value.sceneZero.unlock.status === "SOUND_CHECK"
    && value.sceneZero.unlock.soundCheck?.phase === "listening"
    && value.publicMessage?.content === PLAY_UNLOCK_CONFIG.soundCheck.question
  ), 7000);
  assert.equal(snapshot.audienceWarmup.pendingAdvance.kind, "sound-check-comment");
  await operator.waitForFunction(() => !document.querySelector('section[aria-label="Controles iniciais do aquecimento"] input')?.disabled);
  await operator.keyboard.press("ArrowRight");
  snapshot = await waitForState(context.request, (value) => value.publicMessage?.content === "Boa noite...", 7000);
  assert.equal(snapshot.sceneZero.unlock.soundCheck.phase, "listening", "uma seta deve publicar uma fala sem pular a prova sonora");
  assert.equal(snapshot.audienceWarmup.pendingAdvance.kind, "sound-check-comment");
  await unlock(context.request, "sound-check-skip");
  await new Promise((resolve) => setTimeout(resolve, PLAY_UNLOCK_CONFIG.soundCheck.confirmationDurationMs + 400));
  snapshot = await state(context.request);
  assert.equal(snapshot.sceneZero.unlock.soundCheck.phase, "confirmed", "modo manual não pode sair da confirmação sozinho");
  await operator.keyboard.press("ArrowRight");
  snapshot = await waitForState(context.request, (value) => (
    value.sceneZero.unlock.status === "HUMAN_VERIFICATION"
    && value.publicMessage?.content === PLAY_UNLOCK_CONFIG.questionsIntroduction
  ), 7000);
  assert.equal(snapshot.audienceWarmup.pendingAdvance.kind, "questions-start");
  await new Promise((resolve) => setTimeout(resolve, PLAY_UNLOCK_CONFIG.verificationTitleDurationMs + 400));
  snapshot = await state(context.request);
  assert.equal(snapshot.sceneZero.unlock.status, "HUMAN_VERIFICATION", "modo manual não pode iniciar perguntas sozinho");
  await operator.keyboard.press("ArrowRight");
  snapshot = await waitForState(context.request, (value) => value.audienceWarmup.phase === "questions", 7000);
  assert.equal(snapshot.audienceWarmup.phase, "questions");

  const manualPromptId = snapshot.audienceWarmup.previewPromptId;
  const noReactionButton = operator.getByRole("button", { name: "NINGUÉM REAGIU", exact: true });
  await noReactionButton.click();
  snapshot = await waitForState(context.request, (value) => value.audienceWarmup.reaction?.kind === "none", 7000);
  assert.equal(snapshot.audienceWarmup.previewPromptId, manualPromptId, "reação manual não pode trocar a pergunta");
  await new Promise((resolve) => setTimeout(resolve, 2200));
  snapshot = await state(context.request);
  assert.equal(snapshot.audienceWarmup.reaction?.kind, "none", "reação deve aguardar NEXT no modo manual");
  await operator.keyboard.press("ArrowRight");
  snapshot = await waitForState(context.request, (value) => !value.audienceWarmup.reaction, 7000);

  const historyBeforeBriefing = snapshot.audienceWarmup.history.length;
  const manualFinishQuestions = await context.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action: "questions-complete" } });
  assert.equal(manualFinishQuestions.ok(), true);
  snapshot = await waitForState(context.request, (value) => value.audienceWarmup.phase === "briefing" && value.audienceWarmup.pendingAdvance?.kind === "system-sequence", 7000);
  assert.equal(snapshot.audienceWarmup.history.length, historyBeforeBriefing, "encerrar perguntas não deve publicar fala no modo manual");
  let nextResponse = await context.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action: "manual-next" } });
  assert.equal(nextResponse.ok(), true);
  snapshot = await waitForState(context.request, (value) => value.audienceWarmup.history.length === historyBeforeBriefing + 1, 7000);
  assert.equal(snapshot.audienceWarmup.history.at(-1).text, "PERGUNTAS CONCLUÍDAS. AGORA, UM TESTE.");
  nextResponse = await context.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action: "manual-next" } });
  assert.equal(nextResponse.ok(), true);
  snapshot = await waitForState(context.request, (value) => value.audienceWarmup.history.length === historyBeforeBriefing + 2, 7000);
  assert.equal(snapshot.audienceWarmup.history.at(-1).text, "ESCOLHA A PESSOA AO SEU LADO E FORME UMA DUPLA.");

  const earlyUnlock = await context.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action: "unlock-unlock-now" } });
  assert.equal(earlyUnlock.ok(), false, "o desbloqueio não pode chegar a 100% antes da última mala");
  assert.match((await earlyUnlock.json()).error, /LAST SUITCASE/);

  console.log("play unlock browser tests passed");
} finally {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } }).catch(() => {});
  await context.close();
  await browser.close();
}
