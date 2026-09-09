import assert from "node:assert/strict";
import { chromium } from "playwright";

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
  const unlockPanel = operator.getByLabel("Desbloqueio da peça");
  await unlockPanel.waitFor();
  const bootButton = unlockPanel.getByRole("button", { name: "BOOT", exact: true });
  await bootButton.waitFor();
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
  assert.equal(snapshot.sceneZero.unlock.status, "WAITING_FOR_AUDIENCE");
  assert.equal(snapshot.sceneZero.unlock.progress, 78);
  assert.equal(snapshot.publicMessage.content, "... DESBLOQUEIE A PEÇA");
  assert.equal(snapshot.audienceWarmup.active, false, "a BIOS deve esperar a primeira pergunta do operador");
  assert.equal(snapshot.audienceWarmup.sequence, null, "nenhuma pergunta pode ser escolhida automaticamente");

  await display.getByLabel("BIOS da Cena 0").waitFor();
  await display.getByText("DESBLOQUEIE A PEÇA", { exact: true }).waitFor();
  await display.screenshot({ path: "/private/tmp/caixa-preta-bios-stalled.png" });
  await display.getByLabel("Desbloquear a peça").waitFor({ timeout: 5000 });

  const manualText = "Quem ouviu a máquina bate palmas.";
  const warmupResponse = await context.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action: "send", text: manualText } });
  assert.equal(warmupResponse.ok(), true);
  snapshot = await waitForUnlock(context.request, (value) => value.status === "WARMING_AUDIENCE");
  assert.equal(snapshot.sceneZero.unlock.progress, 78, "o aquecimento deve manter a barra no limite da BIOS");
  await context.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action: "send", text: manualText } });
  snapshot = await state(context.request);
  assert.equal(snapshot.sceneZero.unlock.progress, 78, "repetições também não devem preencher a barra");
  assert.match(await unlockPanel.textContent(), /SÓ É PREENCHIDA AO FINALIZAR O JOGO DAS MALAS/);
  assert.equal(await unlockPanel.getByRole("button", { name: "COMPLETAR BARRA" }).count(), 0);
  assert.equal(await unlockPanel.getByRole("button", { name: "DESBLOQUEAR AGORA" }).count(), 0);

  const prematureFinish = await context.request.post(`${BASE_URL}/api/scene-zero`, { data: { action: "suitcase-finish" } });
  assert.equal(prematureFinish.status(), 409, "o fim manual das malas exige que a Mala 3 esteja ativa");
  snapshot = await state(context.request);
  assert.equal(snapshot.sceneZero.unlock.progress, 78);

  const rejected = await context.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action: "unlock-complete" } });
  assert.equal(rejected.status(), 400, "a API não deve manter um atalho manual de conclusão");

  const soundToggle = operator.getByLabel("ÁUDIO BIOS / UNLOCK");
  await soundToggle.click();
  snapshot = await waitForUnlock(context.request, (value) => value.soundEnabled === false);
  assert.equal(snapshot.sceneZero.unlock.soundEnabled, false);

  const suitcaseFinish = await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/mala win" } });
  assert.equal(suitcaseFinish.ok(), true);
  snapshot = await waitForUnlock(context.request, (value) => value.progress > 78 && value.progress < 100);
  assert.equal(snapshot.sceneZero.suitcaseGame.status, "finished");
  assert.equal(snapshot.sceneZero.unlock.animation.kind, "complete", "o fim das malas deve animar a barra");
  await display.getByText("PEÇA DESBLOQUEADA", { exact: true }).waitFor({ timeout: 8000 });
  await display.screenshot({ path: "/private/tmp/caixa-preta-play-unlocked.png" });
  snapshot = await waitForUnlock(context.request, (value) => value.status === "UNLOCKED");
  assert.equal(snapshot.sceneZero.unlock.onPlayUnlocked.name, "onPlayUnlocked");
  assert.equal(snapshot.sceneZero.unlock.onPlayUnlocked.source, "suitcases-finished");
  await display.getByLabel("Desbloquear a peça").waitFor({ state: "detached" });

  await operator.getByRole("button", { name: "REINICIAR DESBLOQUEIO" }).click();
  snapshot = await waitForUnlock(context.request, (value) => value.status === "STANDBY");
  assert.equal(snapshot.sceneZero.unlock.progress, 0);
  await bootButton.waitFor();

  console.log("play unlock browser tests passed");
} finally {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } }).catch(() => {});
  await context.close();
  await browser.close();
}
