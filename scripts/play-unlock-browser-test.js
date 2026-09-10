import assert from "node:assert/strict";
import { chromium } from "playwright";
import { AUDIENCE_WARMUP_PROMPTS } from "../data/audience-warmup-prompts.js";

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

try {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } });

  const display = await context.newPage();
  await display.setViewportSize({ width: 1920, height: 1080 });
  await display.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await display.waitForFunction(() => document.querySelector('[aria-label="Chat publico"]'));
  await new Promise((resolve) => setTimeout(resolve, 4500));

  let snapshot = await state(context.request);
  assert.equal(snapshot.sceneZero.unlock.status, "STANDBY");
  assert.equal(snapshot.sceneZero.unlock.progress, 0);
  assert.equal((await display.locator("body").innerText()).trim(), "", "a projeção deve permanecer totalmente vazia antes do BOOT");
  assert.equal(await display.getByLabel("BIOS da Cena 0").count(), 0);
  await display.screenshot({ path: "/private/tmp/caixa-preta-standby-black.png" });

  const operator = await context.newPage();
  await operator.setViewportSize({ width: 1440, height: 1100 });
  await operator.goto(`${BASE_URL}/cena-0-controller`, { waitUntil: "domcontentloaded" });
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
  await display.waitForFunction(() => document.body.innerText.trim() === "");
  assert.equal((await display.locator("body").innerText()).trim(), "", "REINICIAR deve devolver a projeção ao preto inicial");
  await new Promise((resolve) => setTimeout(resolve, 750));
  snapshot = await state(context.request);
  assert.equal(snapshot.sceneZero.unlock.status, "STANDBY", "a rotina da BIOS deve permanecer cancelada após REINICIAR");

  await bootButton.click();
  snapshot = await waitForUnlock(context.request, (value) => value.status === "BOOTING");

  await unlock(context.request, "pause-boot");
  snapshot = await state(context.request);
  const pausedProgress = snapshot.sceneZero.unlock.progress;
  assert.equal(snapshot.sceneZero.unlock.bootPaused, true);
  await new Promise((resolve) => setTimeout(resolve, 750));
  snapshot = await state(context.request);
  assert.equal(snapshot.sceneZero.unlock.progress, pausedProgress, "BIOS pausada não deve avançar sozinha");

  for (let index = 0; index < 12 && snapshot.sceneZero.unlock.status === "BOOTING"; index += 1) {
    await unlock(context.request, "advance-boot");
    snapshot = await state(context.request);
  }
  assert.equal(snapshot.sceneZero.unlock.status, "BOOT_FAILED");
  assert.equal(snapshot.sceneZero.unlock.progress, 78);
  assert.equal(snapshot.publicMessage, null, "o erro da BIOS não deve criar fala do chatbot");
  await display.getByLabel("BIOS da Cena 0").waitFor();
  await display.getByText("AÇÃO COLETIVA", { exact: true }).waitFor();
  await new Promise((resolve) => setTimeout(resolve, 800));
  await display.screenshot({ path: "/private/tmp/caixa-preta-bios-stalled.png" });
  await display.getByLabel("Aguardando início do aquecimento").waitFor({ timeout: 7000 });
  snapshot = await state(context.request);
  assert.equal(snapshot.sceneZero.unlock.status, "BOOT_FAILED", "aquecimento não deve começar automaticamente");
  assert.equal(snapshot.publicMessage, null);
  assert.equal(await display.getByText("... PROVE QUE VOCÊ É HUMANO", { exact: true }).count(), 0);
  await display.screenshot({ path: "/private/tmp/caixa-preta-awaiting-warmup-cursor.png" });

  const startWarmupButton = unlockPanel.getByRole("button", { name: "INICIAR AQUECIMENTO", exact: true });
  await startWarmupButton.click();
  const verificationTitle = display.getByText("... PROVE QUE VOCÊ É HUMANO", { exact: true });
  await verificationTitle.waitFor({ timeout: 7000 });
  assert.equal(await verificationTitle.count(), 1, "o título deve aparecer uma única vez");
  snapshot = await state(context.request);
  assert.equal(snapshot.sceneZero.unlock.status, "HUMAN_VERIFICATION");
  assert.equal(snapshot.publicMessage, null, "a primeira pergunta não pode coexistir com o título");
  await new Promise((resolve) => setTimeout(resolve, 900));
  await display.screenshot({ path: "/private/tmp/caixa-preta-human-verification-title.png" });

  snapshot = await waitForUnlock(context.request, (value) => value.status === "WAITING_FOR_AUDIENCE", 7000);
  assert.equal(snapshot.sceneZero.unlock.progress, 78);
  assert.equal(snapshot.sceneZero.unlock.verificationTitleSequence, 1);
  assert.equal(snapshot.publicMessage.content, "ANTES DAS PERGUNTAS, UM TESTE.");
  await verificationTitle.waitFor({ state: "detached" });
  const compactProgress = display.getByRole("complementary", { name: "Progresso" });
  await compactProgress.waitFor();
  assert.equal(await compactProgress.getByText("DESBLOQUEAR A PEÇA", { exact: true }).count(), 0);
  assert.equal(await compactProgress.getByText("VERIFICAÇÃO HUMANA EM ANDAMENTO", { exact: true }).count(), 0);
  await display.getByText(snapshot.publicMessage.content, { exact: true }).waitFor();
  const skipMinigame = await context.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action: "minigame-skip" } });
  assert.equal(skipMinigame.ok(), true);
  snapshot = await waitForState(context.request, (value) => value.audienceWarmup.phase === "questions" && value.audienceWarmup.previewPromptId, 10000);
  const firstLibraryPrompt = AUDIENCE_WARMUP_PROMPTS.find((prompt) => prompt.id === snapshot.audienceWarmup.previewPromptId);
  assert(firstLibraryPrompt);
  await display.getByText(firstLibraryPrompt.text, { exact: true }).waitFor();

  await unlockPanel.getByRole("button", { name: `CONFIRMAR AÇÃO +${firstLibraryPrompt.progressValue}%`, exact: true }).click();
  snapshot = await waitForUnlock(context.request, (value) => Boolean(value.pendingProgress));
  assert.equal(snapshot.sceneZero.unlock.progress, 78, "o feedback técnico deve aparecer antes de a barra subir");
  assert(snapshot.sceneZero.unlock.technicalFeedback);
  const firstProgress = 78 + firstLibraryPrompt.progressValue;
  snapshot = await waitForUnlock(context.request, (value) => value.progress === firstProgress);
  assert(snapshot.sceneZero.unlock.scoredActionIds.includes(firstLibraryPrompt.id));

  const manualText = "FAÇAM UMA ONDA DA ESQUERDA PARA A DIREITA.";
  const warmupResponse = await context.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action: "send", text: manualText, progressValue: 5 } });
  assert.equal(warmupResponse.ok(), true);
  await unlockPanel.getByRole("button", { name: "CONFIRMAR AÇÃO +5%", exact: true }).click();
  snapshot = await waitForUnlock(context.request, (value) => value.progress === firstProgress + 5);

  await unlock(context.request, "set-progress", { progress: 84 });
  snapshot = await waitForUnlock(context.request, (value) => value.progress === 84);
  await unlock(context.request, "increase-participation", { amount: 2 });
  snapshot = await waitForUnlock(context.request, (value) => value.progress === 86 && !value.pendingProgress);
  await unlock(context.request, "decrease-participation", { amount: 2 });
  snapshot = await waitForUnlock(context.request, (value) => value.progress === 84 && !value.pendingProgress);

  assert.equal(await unlockPanel.getByRole("button", { name: "COMPLETAR BARRA", exact: true }).count(), 1);
  assert.equal(await unlockPanel.getByRole("button", { name: "DESBLOQUEAR AGORA", exact: true }).count(), 1);

  const soundToggle = operator.getByLabel("ÁUDIO BIOS / UNLOCK");
  await soundToggle.click();
  snapshot = await waitForUnlock(context.request, (value) => value.soundEnabled === false);
  assert.equal(snapshot.sceneZero.unlock.soundEnabled, false);

  await unlockPanel.getByRole("button", { name: "COMPLETAR BARRA", exact: true }).click();
  snapshot = await waitForUnlock(context.request, (value) => value.progress > 84 && value.progress < 100);
  assert.equal(snapshot.sceneZero.unlock.animation.kind, "complete", "completar barra deve animar a partir do percentual atual");
  await display.getByText("HUMANIDADE SUFICIENTE.", { exact: true }).waitFor({ timeout: 8000 });
  assert.equal(await display.getByText("PEÇA DESBLOQUEADA", { exact: true }).count(), 0);
  await display.screenshot({ path: "/private/tmp/caixa-preta-play-unlocked.png" });
  snapshot = await waitForUnlock(context.request, (value) => value.status === "UNLOCKED");
  assert.equal(snapshot.sceneZero.unlock.onPlayUnlocked.name, "onPlayUnlocked");
  assert.equal(snapshot.sceneZero.unlock.onPlayUnlocked.source, "operator-complete");
  await display.getByRole("complementary", { name: "Progresso" }).waitFor({ state: "detached" });

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
  await unlock(context.request, "start-warmup");
  await waitForUnlock(context.request, (value) => value.status === "WAITING_FOR_AUDIENCE", 7000);
  await unlock(context.request, "unlock-now");
  snapshot = await waitForUnlock(context.request, (value) => value.status === "UNLOCKED");
  assert.equal(snapshot.sceneZero.unlock.onPlayUnlocked.source, "operator-force");

  console.log("play unlock browser tests passed");
} finally {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } }).catch(() => {});
  await context.close();
  await browser.close();
}
