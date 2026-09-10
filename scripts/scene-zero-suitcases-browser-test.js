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
  await waitForState(request, (state) => state.sceneZero.unlock.status === "WAITING_FOR_AUDIENCE", 7000);
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

  await controller.getByRole("heading", { name: "MALA 2 / DESAFIO COM OBJETO" }).waitFor();
  await controller.getByRole("heading", { name: "MALA 3 / FORCA — 60s" }).waitFor();
  await controller.getByRole("heading", { name: "MALA 1 / FIM DO TUTORIAL" }).waitFor();

  let result = await sceneAction(context.request, "suitcase-two-start");
  assert.deepEqual(result.sceneZero.suitcaseGame.openedSuitcases, [2]);
  assert.match(result.sceneZero.suitcaseGame.gincana.currentTask.text, /AJUDA DA PLATEIA/);
  assert.equal(result.sceneZero.suitcaseGame.gincana.currentTask.mandatoryDuration, 30);
  await sceneAction(context.request, "gincana-draw", { challengeId: "quatro-oculos" });
  await controller.getByRole("button", { name: "+ 5 SEGUNDOS", exact: true }).waitFor();
  await projection.getByLabel("Desafio com objeto da Mala 2").waitFor({ timeout: 12000 });
  await projection.getByText("CONSIGA 4 ÓCULOS COM AJUDA DA PLATEIA.", { exact: true }).waitFor();
  await projection.getByText("TODOS FINJAM ESTAR MORTOS NAS CADEIRAS E NO CHÃO.", { exact: true }).waitFor();
  result = await sceneAction(context.request, "gincana-timer-start");
  assert.equal(result.sceneZero.suitcaseGame.gincana.timer.durationSeconds, 42);
  await projection.screenshot({ path: "/private/tmp/caixa-preta-mala-2-desafio.png" });

  result = await sceneAction(context.request, "suitcase-three-start");
  assert.deepEqual(result.sceneZero.suitcaseGame.openedSuitcases, [2, 3]);
  assert.equal(result.sceneZero.suitcaseGame.gincana.timer.status, "cancelled");
  await sceneAction(context.request, "hangman-configure", { wordId: "hangman-11" });
  let state = await waitForState(context.request, (value) => value.sceneZero.suitcaseGame.hangman.status === "active", 12000);
  assert.equal(state.sceneZero.suitcaseGame.hangman.timer.durationSeconds, 60);
  assert.equal(state.sceneZero.suitcaseGame.hangman.timer.status, "running");
  assert(Date.parse(state.sceneZero.suitcaseGame.hangman.timer.endsAt) > Date.now());
  await projection.getByLabel("Forca da Mala 3").waitFor();
  await controller.getByRole("button", { name: "MARCAR ERRO", exact: true }).waitFor();
  const hangmanCard = controller.getByRole("heading", { name: "MALA 3 / FORCA — 60s" }).locator("..");
  assert.equal(await hangmanCard.getByRole("button", { name: "INICIAR", exact: true }).count(), 0, "a forca não deve depender de início manual");
  result = await sceneAction(context.request, "hangman-guess", { guess: "CAIXA PRETA" });
  assert.equal(result.sceneZero.suitcaseGame.hangman.status, "won");
  assert.equal(result.sceneZero.suitcaseGame.hangman.timer.status, "complete");
  await projection.getByText("REGISTRO RECUPERADO.", { exact: true }).waitFor();

  await sceneAction(context.request, "hangman-configure", { wordId: "hangman-03" });
  await sceneAction(context.request, "hangman-start");
  state = await waitForState(context.request, (value) => value.sceneZero.suitcaseGame.hangman.lastResult === "timeout", 65000);
  assert.equal(state.sceneZero.suitcaseGame.hangman.status, "lost");
  assert.equal(state.sceneZero.suitcaseGame.hangman.timer.status, "complete");
  assert.equal(state.sceneZero.suitcaseGame.hangman.timer.remainingSeconds, 0);
  await projection.getByText("TEMPO ESGOTADO.", { exact: true }).waitFor();
  await projection.screenshot({ path: "/private/tmp/caixa-preta-mala-3-tempo-esgotado.png" });

  result = await sceneAction(context.request, "suitcase-one-start");
  assert.deepEqual(result.sceneZero.suitcaseGame.openedSuitcases, [2, 3, 1]);
  await projection.getByLabel("Forca da Mala 3").waitFor({ state: "detached" });
  const tutorialEnd = projection.getByText("FIM DO TUTORIAL", { exact: true });
  await tutorialEnd.waitFor({ timeout: 14000 });
  state = await snapshot(context.request);
  assert.equal(state.sceneZero.suitcaseGame.status, "finished");
  assert.notEqual(state.sceneZero.suitcaseGame.morelBios.status, "running", "glitch não pode começar enquanto FIM DO TUTORIAL está visível");
  await projection.screenshot({ path: "/private/tmp/caixa-preta-mala-1-fim-tutorial.png" });
  state = await waitForState(context.request, (value) => value.sceneZero.suitcaseGame.morelBios.status === "running", 5000);
  assert.equal(state.sceneZero.suitcaseGame.currentSuitcase, 1);
  await projection.getByLabel("Nova BIOS corrompida").waitFor();
  await projection.screenshot({ path: "/private/tmp/caixa-preta-mala-1-bios.png" });

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
