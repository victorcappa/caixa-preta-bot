import assert from "node:assert/strict";
import { chromium } from "playwright";
import { SCENE_ZERO_HANGMAN_INSTRUCTION } from "../data/scene-zero-hangman-words.js";
import {
  SCENE_ZERO_HANGMAN_RETRY_COMMENTS,
  SCENE_ZERO_RETRY_DURATION_SECONDS
} from "../lib/scene-zero/suitcaseGame.js";

const BASE_URL = process.env.CAIXA_PRETA_URL || "http://localhost:3000";
const PROJECTION_WINDOW_ID = `scene-zero-suitcases-test-${Date.now()}`;

async function snapshot(request) {
  const response = await request.get(`${BASE_URL}/api/state`);
  assert.equal(response.ok(), true);
  return response.json();
}

async function sceneAction(request, action, payload = {}) {
  const response = await request.post(`${BASE_URL}/api/scene-zero`, { data: { action, ...payload } });
  const data = await response.json();
  assert.equal(response.ok(), true, `${action}: ${data.error || "request failed"}`);
  return data;
}

async function unlockAction(request, action, payload = {}) {
  const response = await request.post(`${BASE_URL}/api/audience-warmup`, {
    data: { action: `unlock-${action}`, ...payload }
  });
  const data = await response.json();
  assert.equal(response.ok(), true, `unlock-${action}: ${data.error || "request failed"}`);
  return data.unlock;
}

async function waitForState(request, predicate, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await snapshot(request);
    if (predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("timeout waiting for suitcase state");
}


async function unlockProjection(request) {
  let unlock = await unlockAction(request, "boot");
  for (let index = 0; index < 12 && unlock.status === "BOOTING"; index += 1) {
    unlock = await unlockAction(request, "advance-boot");
  }
  assert.equal(unlock.status, "BOOT_FAILED");
  const ending = await unlockAction(request, "end-bios");
  assert.equal(ending.bootProgress, 100);
  await waitForState(request, (candidate) => candidate.sceneZero.unlock.status === "SOUND_CHECK");
  await unlockAction(request, "sound-check-skip");
  await waitForState(request, (candidate) => candidate.audienceWarmup.startChoice?.status === "awaiting", 40000);
  const choiceResponse = await request.post(`${BASE_URL}/api/audience-warmup`, {
    data: { action: "agreements-start-choice", choiceId: "start" }
  });
  assert.equal(choiceResponse.ok(), true);
  const state = await waitForState(
    request,
    (candidate) => candidate.audienceWarmup.phase === "questions" && candidate.sceneZero.unlock.status === "WARMING_AUDIENCE",
    30000
  );
  assert.equal(state.sceneZero.unlock.bootProgress, 100);
  assert.equal(state.sceneZero.unlock.progress, 10, "prova sonora e primeira pergunta devem preparar 10% antes das malas");
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();

try {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } });
  await unlockProjection(context.request);
  const projection = await context.newPage();
  await projection.setViewportSize({ width: 1920, height: 1080 });
  await projection.goto(`${BASE_URL}/videomapping?projectionWindow=${PROJECTION_WINDOW_ID}`, { waitUntil: "domcontentloaded" });
  await projection.waitForSelector('[data-public-layout="quadrants"]');
  const controller = await context.newPage();
  const controllerErrors = [];
  controller.on("pageerror", (error) => controllerErrors.push(error.message));
  await controller.setViewportSize({ width: 1440, height: 1100 });
  await controller.goto(`${BASE_URL}/videomapping-controller`, { waitUntil: "domcontentloaded" });
  await controller.waitForFunction(() => typeof window.__caixaPretaRobotSoundEngine?.attention === "function");

  const attentionButton = controller.getByRole("button", { name: "CHAMAR ATENÇÃO", exact: true });
  await attentionButton.waitFor();
  const manualInstructionField = controller.getByRole("textbox", { name: "Instrução avulsa para o participante" });
  await manualInstructionField.waitFor();
  assert.equal(
    await manualInstructionField.evaluate((element) => element.closest("aside")?.getAttribute("aria-label")),
    "Índice da Cena 0",
    "a instrução avulsa deve permanecer no painel fixo da direita"
  );
  assert.equal(await manualInstructionField.isEnabled(), true, "a instrução avulsa deve estar acessível antes do jogo das malas");
  await controller.evaluate(() => {
    window.__sceneZeroAttentionOscillators = 0;
    const originalCreateOscillator = window.AudioContext.prototype.createOscillator;
    window.AudioContext.prototype.createOscillator = function createAttentionOscillator(...args) {
      window.__sceneZeroAttentionOscillators += 1;
      return originalCreateOscillator.apply(this, args);
    };
  });
  await attentionButton.click();
  const attentionNotice = controller.locator("footer");
  await attentionNotice.filter({ hasText: /SINAL DE ATENÇÃO|ÁUDIO BLOQUEADO/ }).waitFor({ timeout: 5000 });
  assert.equal(await attentionNotice.textContent(), "SINAL DE ATENÇÃO DISPARADO", `falha ao disparar atenção: ${controllerErrors.join(" | ")}`);
  await controller.waitForFunction(() => window.__sceneZeroAttentionOscillators >= 4);

  await controller.getByRole("heading", { name: "MALA 2 / BEXIGAS E CHAVE" }).waitFor();
  await controller.getByRole("heading", { name: "MALA 3 / FORCA — 60s" }).waitFor();
  await controller.getByRole("heading", { name: "MALA 1 / FIM DO TUTORIAL" }).waitFor();

  const manualResponse = await context.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action: "set-manual-mode", manualMode: true } });
  assert.equal(manualResponse.ok(), true);
  let result = await sceneAction(context.request, "suitcase-two-start");
  assert.deepEqual(result.sceneZero.suitcaseGame.openedSuitcases, [2]);
  assert.equal(result.sceneZero.suitcaseGame.gincana.currentTask.id, "bexigas-chave");
  assert.doesNotMatch(result.sceneZero.suitcaseGame.gincana.currentTask.text, /PLATEIA/);
  await waitForState(context.request, (value) => value.sceneZero.suitcaseGame.cuePhase === "selected");
  const suitcaseCue = projection.getByLabel("Mala indicada: 2");
  await suitcaseCue.waitFor();
  assert.equal(await suitcaseCue.getByText("ABRA A MALA").count(), 0, "a mala escolhida deve aguardar a seta antes da ordem de abrir");
  const openSuitcaseButton = controller.getByRole("button", { name: "SEGUIR → ABRA A MALA" });
  await openSuitcaseButton.waitFor();
  await openSuitcaseButton.click({ trial: true });
  await controller.keyboard.press("ArrowRight");
  await waitForState(context.request, (value) => value.sceneZero.suitcaseGame.cuePhase === "open");
  await suitcaseCue.getByText("ABRA A MALA", { exact: true }).waitFor();
  assert.equal(await projection.getByText("ESTOURE AS BEXIGAS ATÉ ENCONTRAR A CHAVE.", { exact: true }).count(), 0, "o desafio deve aguardar a segunda seta");
  const continueSuitcaseButton = controller.getByRole("button", { name: "SEGUIR → ETAPA DA MALA" });
  await continueSuitcaseButton.waitFor();
  await continueSuitcaseButton.click({ trial: true });
  await controller.keyboard.press("ArrowRight");
  await waitForState(context.request, (value) => value.sceneZero.suitcaseGame.cuePhase === "complete");
  await projection.getByText("Quando eu autorizar, você vai estourar as bexigas até encontrar a chave. Espere eu dizer ‘VALENDO!’.", { exact: true }).waitFor();
  let state = await waitForState(context.request, (value) => (
    value.sceneZero.suitcaseGame.contentInstruction.status === "complete"
    && value.publicMessage?.content === "Você terá apenas 15 segundos."
  ));
  assert.equal(await controller.getByRole("button", { name: "+ 5 SEGUNDOS", exact: true }).count(), 0, "o operador não deve ampliar os 15 segundos");
  const addTimeResponse = await context.request.post(`${BASE_URL}/api/scene-zero`, { data: { action: "gincana-timer-add", seconds: 5 } });
  assert.equal(addTimeResponse.ok(), false, "a API também deve recusar tempo extra");
  assert.equal((await addTimeResponse.json()).error, "SCENE ZERO ACTION UNKNOWN");
  assert.equal(await projection.getByLabel("Desafio das bexigas da Mala 2").count(), 0, "a instrução verde deve aparecer antes do painel do desafio");
  assert.equal(await projection.getByText("TODOS FINJAM ESTAR MORTOS NAS CADEIRAS E NO CHÃO.", { exact: true }).count(), 0);
  await projection.evaluate(() => {
    const sound = window.__caixaPretaRobotSoundEngine;
    window.__gincanaGameStartCalls = 0;
    const originalGameStart = sound.gameStart.bind(sound);
    sound.gameStart = (...args) => {
      window.__gincanaGameStartCalls += 1;
      return originalGameStart(...args);
    };
    window.__gincanaWhistleCalls = 0;
    const originalWhistle = sound.whistle.bind(sound);
    sound.whistle = (...args) => {
      window.__gincanaWhistleCalls += 1;
      return originalWhistle(...args);
    };
    window.__ubaHeyPlayCalls = 0;
    window.__ubaHeyPauseCalls = 0;
    const originalPlay = window.HTMLMediaElement.prototype.play;
    const originalPause = window.HTMLMediaElement.prototype.pause;
    window.HTMLMediaElement.prototype.play = function playSceneZeroMedia(...args) {
      if (this.src.includes("uba-hey.mp3")) {
        window.__ubaHeyPlayCalls += 1;
        return Promise.resolve();
      }
      return originalPlay.apply(this, args);
    };
    window.HTMLMediaElement.prototype.pause = function pauseSceneZeroMedia(...args) {
      if (this.src.includes("uba-hey.mp3")) window.__ubaHeyPauseCalls += 1;
      return originalPause.apply(this, args);
    };
  });
  await controller.getByRole("button", { name: "INICIAR 15s", exact: true }).click();
  state = await waitForState(context.request, (value) => value.sceneZero.suitcaseGame.gincana.timer.status === "running");
  assert.equal(state.publicMessage?.content, "VALENDO!", `o início deve publicar VALENDO: ${JSON.stringify(state.publicMessage)}`);
  assert.equal(state.sceneZero.suitcaseGame.gincana.timer.durationSeconds, 15);
  assert.equal(state.sceneZero.suitcaseGame.gincana.soundtrack.status, "idle");
  await projection.getByText("VALENDO!", { exact: true }).waitFor();
  await projection.getByLabel("Desafio das bexigas da Mala 2").waitFor();
  await projection.waitForFunction(() => window.__gincanaGameStartCalls >= 1);
  assert.equal(await projection.evaluate(() => window.__ubaHeyPlayCalls), 0, "o cronômetro não deve iniciar Uba Uba Hey automaticamente");
  assert.match(await projection.locator("audio[data-scene-zero-gincana-music]").getAttribute("src"), /audios%2Fuba-hey\.mp3/);
  const playUbaHeyButton = controller.getByRole("button", { name: "TOCAR UBA UBA HEY", exact: true });
  await playUbaHeyButton.waitFor();
  await playUbaHeyButton.click();
  state = await waitForState(context.request, (value) => value.sceneZero.suitcaseGame.gincana.soundtrack.status === "playing");
  await projection.waitForFunction(() => window.__ubaHeyPlayCalls === 1);
  const stopUbaHeyButton = controller.getByRole("button", { name: "PARAR UBA UBA HEY", exact: true });
  await stopUbaHeyButton.click();
  state = await waitForState(context.request, (value) => value.sceneZero.suitcaseGame.gincana.soundtrack.status === "stopped");
  await projection.waitForFunction(() => window.__ubaHeyPauseCalls >= 1);
  assert.equal(await projection.locator("audio[data-scene-zero-gincana-music]").evaluate((audio) => audio.currentTime), 0);
  await controller.getByRole("button", { name: "TOCAR UBA UBA HEY", exact: true }).click();
  await projection.waitForFunction(() => window.__ubaHeyPlayCalls === 2);
  const physicalTimer = projection.locator("[data-scene-zero-timer]");
  await physicalTimer.waitFor();
  await projection.getByRole("complementary", { name: /Tempo: 1[0-5] segundos/ }).waitFor();
  const physicalTimerGeometry = await physicalTimer.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const auxiliary = document.querySelector('[aria-label="Quadrante de contagens e conteúdos da Cena 0"]').getBoundingClientRect();
    const pane = document.querySelector('[aria-label="Chat publico"]');
    const workspace = document.querySelector('[data-public-layout]');
    return {
      center: { x: bounds.left + (bounds.width / 2), y: bounds.top + (bounds.height / 2) },
      auxiliary: { left: auxiliary.left, top: auxiliary.top, right: auxiliary.right, bottom: auxiliary.bottom },
      layout: workspace?.dataset.publicLayout,
      paneClass: pane?.className,
      workspaceClass: workspace?.className
    };
  });
  const physicalTimerCenter = physicalTimerGeometry.center;
  assert(
    physicalTimerCenter.x > physicalTimerGeometry.auxiliary.left
      && physicalTimerCenter.x < physicalTimerGeometry.auxiliary.right
      && physicalTimerCenter.y > physicalTimerGeometry.auxiliary.top
      && physicalTimerCenter.y < physicalTimerGeometry.auxiliary.bottom,
    `o temporizador deve ocupar o quadrante auxiliar: ${JSON.stringify(physicalTimerGeometry)}`
  );
  await projection.screenshot({ path: "/private/tmp/caixa-preta-mala-2-desafio.png" });

  state = await waitForState(
    context.request,
    (value) => value.sceneZero.suitcaseGame.gincana.timer.status === "failed",
    20000
  );
  assert.equal(state.sceneZero.suitcaseGame.gincana.observation, "tempo esgotado");
  assert.equal(state.sceneZero.suitcaseGame.gincana.soundtrack.status, "stopped");
  await projection.getByLabel("Desafio das bexigas da Mala 2").waitFor({ state: "detached" });
  await projection.waitForFunction(() => window.__gincanaWhistleCalls === 1 && window.__ubaHeyPauseCalls >= 1);
  assert.equal(await projection.locator("audio[data-scene-zero-gincana-music]").evaluate((audio) => audio.currentTime), 0);

  result = await sceneAction(context.request, "gincana-timer-restart");
  assert.equal(result.sceneZero.suitcaseGame.gincana.timer.status, "running");
  assert.equal(result.sceneZero.suitcaseGame.gincana.soundtrack.status, "idle");
  assert.equal(await projection.evaluate(() => window.__ubaHeyPlayCalls), 2, "reiniciar o cronômetro não deve reiniciar a música");
  await controller.getByRole("button", { name: "TOCAR UBA UBA HEY", exact: true }).click();
  await projection.waitForFunction(() => window.__ubaHeyPlayCalls === 3);
  result = await sceneAction(context.request, "gincana-complete");
  assert.equal(result.sceneZero.suitcaseGame.gincana.timer.status, "completed");
  assert.equal(result.sceneZero.suitcaseGame.gincana.soundtrack.status, "stopped");
  await projection.getByLabel("Desafio das bexigas da Mala 2").waitFor({ state: "detached" });
  await projection.getByText("CHAVE ENCONTRADA.", { exact: true }).waitFor();
  await projection.locator('[data-warmup-effect="success"]').waitFor();
  await projection.waitForFunction(() => window.__ubaHeyPauseCalls >= 3);

  const automaticResponse = await context.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action: "set-manual-mode", manualMode: false } });
  assert.equal(automaticResponse.ok(), true);
  result = await sceneAction(context.request, "suitcase-three-start");
  assert.deepEqual(result.sceneZero.suitcaseGame.openedSuitcases, [2, 3]);
  assert.equal(result.sceneZero.suitcaseGame.gincana.timer.status, "completed");
  assert.equal(await projection.locator("audio[data-scene-zero-gincana-music]").evaluate((audio) => audio.paused && audio.currentTime === 0), true);
  await sceneAction(context.request, "hangman-configure", { wordId: "hangman-11" });
  state = await waitForState(context.request, (value) => value.publicMessage?.content === SCENE_ZERO_HANGMAN_INSTRUCTION, 12000);
  assert.equal(state.sceneZero.suitcaseGame.hangman.status, "ready", "a forca deve aguardar a instrução terminar");
  await projection.getByText(SCENE_ZERO_HANGMAN_INSTRUCTION, { exact: true }).waitFor();
  state = await waitForState(context.request, (value) => value.sceneZero.suitcaseGame.hangman.status === "active", 7000);
  assert.equal(state.sceneZero.suitcaseGame.hangman.timer.durationSeconds, 60);
  assert.equal(state.sceneZero.suitcaseGame.hangman.timer.status, "running");
  assert.equal(state.sceneZero.suitcaseGame.hangman.theme, "arquivo");
  assert(Date.parse(state.sceneZero.suitcaseGame.hangman.timer.endsAt) > Date.now());
  assert.equal(state.publicMessage.content, SCENE_ZERO_HANGMAN_INSTRUCTION);
  const hangmanCard = controller.getByRole("heading", { name: "MALA 3 / FORCA — 60s" }).locator("..");
  const hangmanProjection = projection.getByLabel("Forca da Mala 3");
  await hangmanProjection.waitFor();
  await hangmanProjection.getByText("ARQUIVO", { exact: true }).waitFor();
  await hangmanCard.getByText("ARQUIVO", { exact: true }).waitFor();
  const hangmanTimerCenter = await projection.locator("[data-scene-zero-timer]").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { x: bounds.left + (bounds.width / 2), y: bounds.top + (bounds.height / 2) };
  });
  assert.ok(Math.abs(hangmanTimerCenter.x - physicalTimerCenter.x) <= 1, "a forca deve manter a mesma posição horizontal do temporizador");
  assert.ok(Math.abs(hangmanTimerCenter.y - physicalTimerCenter.y) <= 1, "a forca deve manter a mesma posição vertical do temporizador");
  await controller.getByRole("button", { name: "MARCAR ERRO", exact: true }).waitFor();
  assert.equal(await hangmanCard.getByRole("button", { name: "INICIAR", exact: true }).count(), 0, "a forca não deve depender de início manual");
  assert.equal(await hangmanProjection.getByText("ESTÁVEL", { exact: true }).count(), 0, "a projeção não deve narrar o estado por texto");
  assert.equal(await hangmanCard.getByText("ESTADO DE VOO", { exact: true }).count(), 0, "o operador não deve receber o estado textual antigo");
  await projection.evaluate(() => {
    const sound = window.__caixaPretaRobotSoundEngine;
    window.__hangmanImpactCalls = 0;
    const originalImpact = sound.impact.bind(sound);
    sound.impact = (...args) => {
      window.__hangmanImpactCalls += 1;
      return originalImpact(...args);
    };
  });
  const hangmanDangerColors = [];
  for (let errorCount = 1; errorCount <= 2; errorCount += 1) {
    result = await sceneAction(context.request, "hangman-error");
    assert.equal(result.sceneZero.suitcaseGame.hangman.errorCount, errorCount);
    await projection.waitForFunction((expectedCount) => {
      const overlay = document.querySelector('[aria-label="Forca da Mala 3"]');
      return overlay && getComputedStyle(overlay).animationName.includes("hangmanErrorHit")
        && window.__hangmanImpactCalls >= expectedCount;
    }, errorCount);
    hangmanDangerColors.push(await hangmanProjection.evaluate((element) => (
      getComputedStyle(element).getPropertyValue("--hangman-danger").trim()
    )));
  }
  assert.notEqual(hangmanDangerColors[0], hangmanDangerColors[1], "cada erro deve deixar a forca mais vermelha");
  assert.equal(await projection.evaluate(() => window.__hangmanImpactCalls), 2, "cada erro deve disparar um impacto sonoro");
  result = await sceneAction(context.request, "hangman-guess", { guess: "CAIXA PRETA" });
  assert.equal(result.sceneZero.suitcaseGame.hangman.status, "won");
  assert.equal(result.sceneZero.suitcaseGame.hangman.timer.status, "complete");
  await projection.getByLabel("Forca da Mala 3").waitFor({ state: "detached" });
  await projection.getByText("REGISTRO RECUPERADO. A PALAVRA ERA CAIXA PRETA.", { exact: true }).waitFor();
  await projection.locator('[data-warmup-effect="success"]').waitFor();

  await sceneAction(context.request, "hangman-configure", { wordId: "hangman-03" });
  await sceneAction(context.request, "hangman-start");
  await sceneAction(context.request, "hangman-lose");
  state = await waitForState(context.request, (value) => value.sceneZero.suitcaseGame.hangman.retry?.status === "announcing");
  assert.equal(state.sceneZero.suitcaseGame.hangman.status, "retry_wait");
  assert.equal(state.sceneZero.suitcaseGame.hangman.timer.status, "retry_wait");
  assert.equal(state.sceneZero.suitcaseGame.hangman.revealedWord, null);
  await projection.getByLabel("Forca da Mala 3").waitFor({ state: "detached" });
  await projection.getByText(SCENE_ZERO_HANGMAN_RETRY_COMMENTS[0], { exact: true }).waitFor();
  await projection.locator('[data-warmup-effect="failure"]').waitFor();
  await projection.waitForFunction(() => window.__hangmanImpactCalls >= 3);
  await projection.screenshot({ path: "/private/tmp/caixa-preta-mala-3-tempo-esgotado.png" });
  state = await waitForState(
    context.request,
    (value) => value.sceneZero.suitcaseGame.hangman.retry?.status === "running",
    10000
  );
  assert.equal(state.sceneZero.suitcaseGame.hangman.status, "active");
  assert.equal(state.sceneZero.suitcaseGame.hangman.timer.status, "running");
  assert.equal(state.sceneZero.suitcaseGame.hangman.timer.durationSeconds, SCENE_ZERO_RETRY_DURATION_SECONDS);
  assert(state.sceneZero.suitcaseGame.hangman.timer.remainingSeconds <= SCENE_ZERO_RETRY_DURATION_SECONDS);
  await projection.getByLabel("Forca da Mala 3").waitFor();
  result = await sceneAction(context.request, "hangman-guess", { guess: "ALTITUDE" });
  assert.equal(result.sceneZero.suitcaseGame.hangman.status, "won");
  await projection.getByText("REGISTRO RECUPERADO. A PALAVRA ERA ALTITUDE.", { exact: true }).waitFor();
  await projection.locator('[data-warmup-effect="success"]').waitFor();

  result = await sceneAction(context.request, "suitcase-one-start");
  assert.deepEqual(result.sceneZero.suitcaseGame.openedSuitcases, [2, 3, 1]);
  await projection.getByLabel("Forca da Mala 3").waitFor({ state: "detached" });
  await projection.getByText("Use o disco no toca-discos.", { exact: true }).waitFor({ timeout: 14000 });
  const tutorialEnd = projection.getByText("FIM DO TUTORIAL", { exact: true });
  await tutorialEnd.waitFor({ timeout: 14000 });
  state = await snapshot(context.request);
  assert.equal(state.sceneZero.suitcaseGame.status, "finished");
  assert.equal(state.sceneZero.unlock.progress, 100, "a última mala deve ser a única conclusão da barra");
  assert.equal(state.sceneZero.unlock.unlockSequenceSource, "suitcases-finished");
  assert.notEqual(state.sceneZero.suitcaseGame.morelBios.status, "running", "glitch não pode começar enquanto FIM DO TUTORIAL está visível");
  await projection.screenshot({ path: "/private/tmp/caixa-preta-mala-1-fim-tutorial.png" });
  state = await waitForState(context.request, (value) => value.sceneZero.suitcaseGame.morelBios.status === "running", 5000);
  assert.equal(state.sceneZero.suitcaseGame.currentSuitcase, 1);
  assert.equal(state.sceneZero.unlock.status, "UNLOCKED");
  assert.equal(state.sceneZero.unlock.progress, 100);
  await projection.getByLabel("Nova BIOS corrompida").waitFor();
  await projection.getByRole("progressbar", { name: "DESBLOQUEIO DO ESPETÁCULO: 100%" }).waitFor();
  state = await waitForState(context.request, (value) => value.glitch.active && value.glitch.scope === "full-frame", 5000);
  assert.equal(state.glitch.scope, "full-frame", "o glitch final deve tomar o quadro público inteiro");
  await projection.screenshot({ path: "/private/tmp/caixa-preta-mala-1-bios.png" });

  state = await waitForState(
    context.request,
    (value) => Object.values(value.displayBlackout.targets || {}).every(Boolean),
    35000
  );
  assert.equal(state.displayBlackout.updatedBy, "scene-zero-final");
  await projection.locator('[data-blackout-target="chatbot"]').waitFor();

  await controller.locator('a[href="#scene-zero-unlock"]').click();
  state = await waitForState(
    context.request,
    (value) => value.sceneZero.stage === "idle"
      && value.sceneZero.suitcaseGame.currentSuitcase === null
      && value.audienceWarmup.phase === "questions",
    10000
  );
  assert.equal(state.sceneZero.suitcaseGame.gincana.timer.status, "idle");
  assert.equal(state.sceneZero.suitcaseGame.hangman.status, "idle");
  assert.equal(state.sceneZero.suitcaseGame.morelBios.status, "idle");
  assert.equal(state.sceneZero.glitchLevel, "normal");
  assert.equal(state.mode, "host");
  assert.equal(Object.values(state.displayBlackout.targets || {}).some(Boolean), false);
  assert.equal(state.sceneZero.unlock.status, "WARMING_AUDIENCE");
  assert.equal(state.sceneZero.unlock.progress, 99, "voltar ao aquecimento deve reabrir a barra sem manter o desbloqueio final");
  assert(state.audienceWarmup.sequence?.promptId, "o aquecimento retomado deve republicar uma pergunta contextual");
  await projection.locator('[data-blackout-target="chatbot"]').waitFor({ state: "detached" });

  console.log("scene zero suitcase browser tests passed");
} finally {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } }).catch(() => {});
  await context.close();
  await browser.close();
}
