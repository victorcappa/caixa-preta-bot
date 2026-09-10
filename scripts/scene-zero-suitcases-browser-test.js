import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = process.env.CAIXA_PRETA_URL || "http://localhost:3000";

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

async function waitForState(request, predicate, timeoutMs = 15000) {
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
  await unlockAction(request, "start-warmup");
  await waitForState(request, (state) => state.sceneZero.unlock.status === "WARMING_AUDIENCE", 7000);
  await unlockAction(request, "unlock-now");
  await waitForState(request, (state) => state.sceneZero.unlock.status === "UNLOCKED", 10000);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();

try {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } });
  await unlockProjection(context.request);
  const projection = await context.newPage();
  await projection.setViewportSize({ width: 1920, height: 1080 });
  await projection.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  const controller = await context.newPage();
  await controller.setViewportSize({ width: 1440, height: 1100 });
  await controller.goto(`${BASE_URL}/cena-0-controller`, { waitUntil: "domcontentloaded" });

  await controller.getByRole("heading", { name: "MALA 1 / DESAFIO FÍSICO" }).waitFor();
  await controller.getByRole("heading", { name: "MALA 2 / FORCA — QUEDA" }).waitFor();
  await controller.getByRole("heading", { name: "MALA 3 / BUG + BIOS CORROMPIDA" }).waitFor();

  let result = await sceneAction(context.request, "suitcase-one-start");
  assert.deepEqual(result.sceneZero.suitcaseGame.openedSuitcases, [1]);
  assert.equal(result.sceneZero.suitcaseGame.gincana.currentTask.id, "seis-sapatos");
  result = await sceneAction(context.request, "gincana-draw");
  assert.notEqual(result.sceneZero.suitcaseGame.gincana.currentTask.id, "seis-sapatos");
  await sceneAction(context.request, "gincana-draw", { challengeId: "cinco-pessoas-em-pe" });
  await controller.getByRole("button", { name: "+ 5 SEGUNDOS", exact: true }).waitFor();
  await controller.getByRole("button", { name: "SUCESSO", exact: true }).waitFor();
  await controller.getByRole("button", { name: "FALHA", exact: true }).waitFor();
  result = await sceneAction(context.request, "gincana-timer-add", { seconds: 5 });
  assert.equal(result.sceneZero.suitcaseGame.gincana.timer.durationSeconds, 10);
  assert.equal(result.sceneZero.suitcaseGame.gincana.timer.remainingSeconds, 10);
  await sceneAction(context.request, "gincana-draw", { challengeId: "cinco-pessoas-em-pe" });
  await projection.getByLabel("Desafio físico da Mala 1").waitFor({ timeout: 12000 });
  await sceneAction(context.request, "gincana-timer-start");
  result = await sceneAction(context.request, "gincana-timer-pause");
  assert.equal(result.sceneZero.suitcaseGame.gincana.timer.status, "paused");
  result = await sceneAction(context.request, "gincana-timer-resume");
  assert.equal(result.sceneZero.suitcaseGame.gincana.timer.status, "running");
  await sceneAction(context.request, "gincana-timer-restart");
  await projection.getByText("CONSIGA 5 PESSOAS DE PÉ EM 5 SEGUNDOS.", { exact: true }).waitFor();
  await projection.locator("time").getByText("5", { exact: true }).waitFor();
  await projection.screenshot({ path: "/private/tmp/caixa-preta-mala-1-desafio.png" });
  let state = await waitForState(context.request, (value) => value.sceneZero.suitcaseGame.gincana.timer.status === "complete", 8000);
  assert.equal(state.sceneZero.suitcaseGame.gincana.timer.remainingSeconds, 0);
  await projection.getByText("TEMPO ESGOTADO.", { exact: true }).waitFor();
  result = await sceneAction(context.request, "gincana-complete");
  assert.equal(result.sceneZero.suitcaseGame.gincana.result, "completed");
  await projection.getByText("5/5", { exact: true }).waitFor();
  await sceneAction(context.request, "gincana-draw", { challengeId: "quatro-oculos" });
  result = await sceneAction(context.request, "gincana-failed");
  assert.equal(result.sceneZero.suitcaseGame.gincana.result, "failed");

  result = await sceneAction(context.request, "suitcase-two-start");
  assert.deepEqual(result.sceneZero.suitcaseGame.openedSuitcases, [1, 2]);
  await projection.getByLabel("Desafio físico da Mala 1").waitFor({ state: "detached" });
  const automaticWordId = result.sceneZero.suitcaseGame.hangman.wordId;
  result = await sceneAction(context.request, "hangman-new");
  assert.notEqual(result.sceneZero.suitcaseGame.hangman.wordId, automaticWordId);
  await sceneAction(context.request, "hangman-configure", { wordId: "hangman-11" });
  await sceneAction(context.request, "hangman-start");
  await controller.getByRole("button", { name: "MARCAR ERRO", exact: true }).waitFor();
  await controller.getByRole("button", { name: "REVELAR PALAVRA", exact: true }).waitFor();
  await controller.getByRole("button", { name: "VITÓRIA", exact: true }).waitFor();
  await controller.getByRole("button", { name: "DERROTA", exact: true }).waitFor();
  await projection.getByLabel("Forca da Mala 2").waitFor({ timeout: 12000 });
  result = await sceneAction(context.request, "hangman-error");
  assert.equal(result.sceneZero.suitcaseGame.hangman.flightState, "ALERTA");
  result = await sceneAction(context.request, "hangman-restart");
  assert.equal(result.sceneZero.suitcaseGame.hangman.errorCount, 0);
  for (const letter of ["C", "A", "I", "X", "P", "R", "E", "T"]) {
    await sceneAction(context.request, "hangman-guess", { guess: letter });
  }
  state = await snapshot(context.request);
  assert.equal(state.sceneZero.suitcaseGame.hangman.status, "won");
  assert.equal(state.sceneZero.suitcaseGame.hangman.revealedWord, "CAIXA PRETA");
  await projection.getByText("REGISTRO RECUPERADO.", { exact: true }).waitFor();

  await sceneAction(context.request, "hangman-configure", { wordId: "hangman-03" });
  await sceneAction(context.request, "hangman-start");
  for (const [guess, expected] of [["Q", "ALERTA"], ["J", "PERDA DE ALTITUDE"], ["X", "FALHA"], ["Z", "IMPACTO"]]) {
    result = await sceneAction(context.request, "hangman-guess", { guess });
    assert.equal(result.sceneZero.suitcaseGame.hangman.flightState, expected);
  }
  assert.equal(result.sceneZero.suitcaseGame.hangman.status, "lost");
  assert.equal(result.sceneZero.suitcaseGame.hangman.revealedWord, "ALTITUDE");
  await projection.getByText("IMPACTO.", { exact: true }).waitFor();
  await projection.screenshot({ path: "/private/tmp/caixa-preta-mala-2-impacto.png" });

  result = await sceneAction(context.request, "suitcase-three-start");
  assert.deepEqual(result.sceneZero.suitcaseGame.openedSuitcases, [1, 2, 3]);
  await projection.getByLabel("Forca da Mala 2").waitFor({ state: "detached" });
  state = await waitForState(context.request, (value) => value.sceneZero.suitcaseGame.morelBios.status === "running", 12000);
  assert.equal(state.sceneZero.suitcaseGame.currentSuitcase, 3);
  await projection.getByLabel("Nova BIOS corrompida").waitFor();
  await projection.waitForTimeout(1800);
  await projection.screenshot({ path: "/private/tmp/caixa-preta-mala-3-bios.png" });

  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } });
  state = await waitForState(context.request, (value) => value.sceneZero.suitcaseGame.currentSuitcase === null);
  assert.equal(state.sceneZero.suitcaseGame.gincana.timer.status, "idle");
  assert.equal(state.sceneZero.suitcaseGame.hangman.status, "idle");
  assert.equal(state.sceneZero.suitcaseGame.morelBios.status, "idle");
  assert.equal(state.sceneZero.glitchLevel, "normal");

  console.log("scene zero suitcase browser tests passed");
} finally {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } }).catch(() => {});
  await context.close();
  await browser.close();
}
