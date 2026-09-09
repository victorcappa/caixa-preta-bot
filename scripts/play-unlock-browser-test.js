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
  let snapshot = await waitForUnlock(context.request, (value) => value.status === "WAITING_FOR_AUDIENCE", 12000);
  assert.equal(snapshot.sceneZero.unlock.progress, 78, "BIOS automática deve travar no limite configurado");

  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } });
  await unlock(context.request, "pause-boot");
  snapshot = await state(context.request);
  const pausedProgress = snapshot.sceneZero.unlock.progress;
  assert.equal(snapshot.sceneZero.unlock.status, "BOOTING");
  assert.equal(snapshot.sceneZero.unlock.bootPaused, true);
  const display = await context.newPage();
  await display.setViewportSize({ width: 1920, height: 1080 });
  await display.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await new Promise((resolve) => setTimeout(resolve, 750));
  snapshot = await state(context.request);
  assert.equal(snapshot.sceneZero.unlock.progress, pausedProgress, "BIOS pausada não deve avançar sozinha");

  for (let index = 0; index < 12 && snapshot.sceneZero.unlock.status === "BOOTING"; index += 1) {
    await unlock(context.request, "advance-boot");
    snapshot = await state(context.request);
  }
  assert.equal(snapshot.sceneZero.unlock.status, "WAITING_FOR_AUDIENCE");
  assert.equal(snapshot.sceneZero.unlock.progress, 78);
  assert.equal(snapshot.publicMessage.content, "ainda falta uma coisa. vocês.");

  await display.getByLabel("BIOS da Cena 0").waitFor();
  await display.getByText("DESBLOQUEIE A PEÇA", { exact: true }).waitFor();
  await new Promise((resolve) => setTimeout(resolve, 800));
  await display.screenshot({ path: "/private/tmp/caixa-preta-bios-stalled.png" });
  await display.getByLabel("Desbloquear a peça").waitFor({ timeout: 5000 });
  await display.screenshot({ path: "/private/tmp/caixa-preta-unlock-warmup.png" });
  assert.equal(await display.getByRole("button", { name: "COMPLETAR BARRA" }).count(), 0, "controles privados não podem aparecer na projeção");

  const operator = await context.newPage();
  await operator.setViewportSize({ width: 1440, height: 1100 });
  await operator.goto(`${BASE_URL}/cena-0-controller`, { waitUntil: "domcontentloaded" });
  const unlockPanel = operator.getByLabel("Desbloqueio da peça");
  await unlockPanel.waitFor();
  await operator.waitForFunction(() => document.querySelector('[aria-label="Desbloqueio da peça"]')?.textContent.includes("FALTA22%"));
  assert.match(await unlockPanel.textContent(), /TRAVA DA BIOS78%/);
  assert.match(await unlockPanel.textContent(), /FALTA22%/);

  const progressInput = operator.getByLabel("Percentual de desbloqueio");
  await progressInput.fill("85");
  await operator.getByRole("button", { name: "DEFINIR", exact: true }).click();
  snapshot = await waitForUnlock(context.request, (value) => value.progress === 85);
  assert.equal(snapshot.sceneZero.unlock.status, "WARMING_AUDIENCE");

  await operator.getByRole("button", { name: "− PARTICIPAÇÃO" }).click();
  snapshot = await waitForUnlock(context.request, (value) => value.progress === 83);
  await operator.getByRole("button", { name: "+ PARTICIPAÇÃO" }).click();
  snapshot = await waitForUnlock(context.request, (value) => value.progress === 85);

  const soundToggle = operator.getByLabel("ÁUDIO BIOS / UNLOCK");
  await soundToggle.click();
  snapshot = await waitForUnlock(context.request, (value) => value.soundEnabled === false);
  assert.equal(snapshot.sceneZero.unlock.soundEnabled, false);

  const manualText = "Quem ouviu a máquina bate palmas.";
  await context.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action: "send", text: manualText } });
  snapshot = await waitForUnlock(context.request, (value) => value.progress === 89);
  await context.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action: "send", text: manualText } });
  await new Promise((resolve) => setTimeout(resolve, 150));
  snapshot = await state(context.request);
  assert.equal(snapshot.sceneZero.unlock.progress, 89, "a mesma ação não deve pontuar novamente");

  await operator.getByRole("button", { name: "COMPLETAR BARRA" }).click();
  snapshot = await waitForUnlock(context.request, (value) => value.progress > 89 && value.progress < 100);
  assert.equal(snapshot.sceneZero.unlock.animation.kind, "complete", "completar deve animar antes de 100%");
  await display.getByText("PEÇA DESBLOQUEADA", { exact: true }).waitFor({ timeout: 8000 });
  await display.screenshot({ path: "/private/tmp/caixa-preta-play-unlocked.png" });
  snapshot = await waitForUnlock(context.request, (value) => value.status === "UNLOCKED");
  assert.equal(snapshot.sceneZero.unlock.onPlayUnlocked.name, "onPlayUnlocked");
  await display.getByLabel("Desbloquear a peça").waitFor({ state: "detached" });

  await operator.getByRole("button", { name: "REINICIAR DESBLOQUEIO" }).click();
  snapshot = await waitForUnlock(context.request, (value) => value.status === "BOOTING" && value.progress < 78);
  assert.deepEqual(snapshot.sceneZero.unlock.scoredActionIds, []);
  await operator.getByRole("button", { name: "DESBLOQUEAR AGORA" }).click();
  snapshot = await waitForUnlock(context.request, (value) => value.status === "UNLOCKED");
  assert.equal(snapshot.sceneZero.unlock.onPlayUnlocked.source, "operator-force");

  console.log("play unlock browser tests passed");
} finally {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } }).catch(() => {});
  await context.close();
  await browser.close();
}
