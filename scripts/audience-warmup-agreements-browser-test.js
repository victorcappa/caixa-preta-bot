import assert from "node:assert/strict";
import { chromium } from "playwright";
import {
  AUDIENCE_WARMUP_AGREEMENTS,
  AUDIENCE_WARMUP_REQUIRED_TIMER_DELAY_MS,
  AUDIENCE_WARMUP_START_CHOICES
} from "../data/audience-warmup-prompts.js";

const BASE_URL = process.env.CAIXA_PRETA_URL || "http://localhost:3000";

async function snapshot(request) {
  const response = await request.get(`${BASE_URL}/api/state`);
  assert.equal(response.ok(), true);
  return response.json();
}

async function post(request, action, payload = {}, expectedOk = true) {
  const response = await request.post(`${BASE_URL}/api/audience-warmup`, {
    data: { action, ...payload }
  });
  const body = await response.json();
  assert.equal(response.ok(), expectedOk, `${action}: ${body.error || "request failed"}`);
  return body;
}

async function waitForState(request, predicate, label, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await snapshot(request);
    if (predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function enterManualAgreements(request) {
  await request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } });
  await post(request, "set-manual-mode", { manualMode: true });
  let response = await post(request, "unlock-boot");
  for (let index = 0; index < 12 && response.unlock.status === "BOOTING"; index += 1) {
    response = await post(request, "unlock-advance-boot");
  }
  assert.equal(response.unlock.status, "BOOT_FAILED");
  await post(request, "unlock-end-bios");
  await waitForState(request, (state) => state.sceneZero.unlock.status === "SOUND_CHECK", "sound check", 7000);
  await post(request, "manual-next");
  await waitForState(request, (state) => state.sceneZero.unlock.soundCheck?.phase === "listening", "sound check listening");
  await post(request, "unlock-sound-check-skip");
  await post(request, "manual-next");
  return waitForState(
    request,
    (state) => state.sceneZero.unlock.status === "HUMAN_VERIFICATION" && state.audienceWarmup.pendingAdvance?.kind === "system-sequence",
    "human verification introduction"
  );
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();

try {
  await enterManualAgreements(context.request);

  const display = await context.newPage();
  await display.setViewportSize({ width: 1920, height: 1080 });
  await display.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await display.waitForFunction(() => window.__caixaPretaRobotSoundEngine?.attention);
  await display.evaluate(async () => {
    const engine = window.__caixaPretaRobotSoundEngine;
    await engine.unlock();
    window.__agreementSoundCounts = { attention: 0, playAttentionPhrase: 0, countdown: 0, error: 0, success: 0, gameStart: 0, gameOver: 0 };
    for (const method of Object.keys(window.__agreementSoundCounts)) {
      const original = engine[method].bind(engine);
      engine[method] = (...args) => {
        window.__agreementSoundCounts[method] += 1;
        return original(...args);
      };
    }
  });

  const operator = await context.newPage();
  await operator.setViewportSize({ width: 1440, height: 1100 });
  await operator.goto(`${BASE_URL}/cena-0-controller`, { waitUntil: "domcontentloaded" });
  const warmupToggle = operator.locator("#scene-zero-unlock").getByRole("button", { name: /ESQUENTAR PÚBLICO/ });
  await warmupToggle.waitFor();
  await warmupToggle.click();

  for (const agreement of AUDIENCE_WARMUP_AGREEMENTS) {
    await post(context.request, "manual-next");
    let state = await waitForState(
      context.request,
      (candidate) => agreement.kind === "silent"
        ? candidate.audienceWarmup.display?.source === `audience-warmup-agreements:${agreement.id}`
        : candidate.publicMessage?.content === agreement.text,
      agreement.id
    );
    if (agreement.kind === "silent") {
      assert.equal(state.publicMessage, null);
      await display.getByLabel("Cursor de espera da Caixa Preta").waitFor();
    } else {
      await display.getByText(agreement.text, { exact: true }).waitFor();
    }

    if (agreement.id === "attention") {
      await display.waitForFunction(() => window.__agreementSoundCounts.attention >= 1);
      await display.waitForFunction(() => window.__agreementSoundCounts.playAttentionPhrase >= 2);
      assert.equal(await display.evaluate(() => window.__agreementSoundCounts.attention), 1);
      assert.equal(await display.evaluate(() => window.__agreementSoundCounts.playAttentionPhrase), 2);
    }
    if (agreement.id === "look-at-screen") {
      assert.equal(
        await display.evaluate(() => window.__agreementSoundCounts.attention),
        1,
        "a segunda frase não deve repetir o sinal de atenção"
      );
      assert.equal(await display.evaluate(() => window.__agreementSoundCounts.playAttentionPhrase), 2);
    }
    if (agreement.id === "timer-idle-cursor") {
      assert.equal(await display.evaluate(() => window.__agreementSoundCounts.attention), 1);
      assert.equal(await display.evaluate(() => window.__agreementSoundCounts.playAttentionPhrase), 2);
    }
    if (agreement.id === "timer-notification-test") {
      await display.waitForFunction(() => window.__agreementSoundCounts.attention >= 2);
      await display.waitForFunction(() => window.__agreementSoundCounts.playAttentionPhrase >= 4);
      assert.equal(await display.evaluate(() => window.__agreementSoundCounts.attention), 2);
      assert.equal(await display.evaluate(() => window.__agreementSoundCounts.playAttentionPhrase), 4);
      const blocked = await post(context.request, "manual-next", {}, false);
      assert.match(blocked.error, /DEMONSTRAÇÃO/);
      const waitMs = Math.max(0, Date.parse(state.audienceWarmup.pendingAdvance.dueAt) - Date.now()) + 100;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    if (agreement.effect === "timer") {
      assert.equal(state.audienceWarmup.actionTimer.durationSeconds, 5);
      const timer = display.locator('[class*="actionTimer"]');
      await timer.waitFor();
      assert.match(await timer.textContent(), /^[1-5]$/);
      await display.waitForFunction(() => window.__agreementSoundCounts.countdown >= 1);
      const blocked = await post(context.request, "manual-next", {}, false);
      assert.match(blocked.error, /DEMONSTRAÇÃO/);
      const waitMs = Math.max(0, Date.parse(state.audienceWarmup.pendingAdvance.dueAt) - Date.now()) + 100;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    if (agreement.effect === "failure") {
      await display.locator('[data-warmup-effect="failure"]').waitFor();
      await display.getByText("ERRO", { exact: true }).waitFor();
      await display.waitForFunction(() => window.__agreementSoundCounts.error >= 1);
    }
    if (agreement.effect === "success") {
      await display.locator('[data-warmup-effect="success"]').waitFor();
      await display.getByText("ACERTO", { exact: true }).waitFor();
      await display.waitForFunction(() => window.__agreementSoundCounts.success >= 1);
    }
    if (agreement.requiresOperatorChoice) {
      state = await waitForState(
        context.request,
        (candidate) => candidate.audienceWarmup.startChoice?.status === "awaiting",
        "operator start choice"
      );
      assert.equal(state.audienceWarmup.pendingAdvance, null);
      await display.getByRole("button", { name: "START", exact: true }).waitFor();
      await display.getByRole("button", { name: "GAME OVER", exact: true }).waitFor();
    }
  }

  const gameOver = AUDIENCE_WARMUP_START_CHOICES.find((choice) => choice.id === "game-over");
  if (await warmupToggle.getAttribute("aria-expanded") !== "true") {
    await warmupToggle.click();
  }
  await operator.getByRole("button", { name: "GAME OVER", exact: true }).click();
  await display.waitForFunction(() => window.__agreementSoundCounts.gameOver >= 1);
  assert.equal(await display.evaluate(() => window.__agreementSoundCounts.gameOver), 1);
  assert.equal(await display.evaluate(() => window.__agreementSoundCounts.gameStart), 0);
  const selected = await waitForState(
    context.request,
    (state) => state.audienceWarmup.startChoice?.status === "selected",
    "GAME OVER selection feedback"
  );
  assert.equal(selected.audienceWarmup.startChoice.selectedId, "game-over");
  assert.equal(selected.publicMessage.content, "Podemos começar?");
  const selectedPublicButton = display.locator('[aria-label="Escolhas para começar"] button[data-selected="true"]');
  await selectedPublicButton.waitFor();
  assert.equal(await selectedPublicButton.textContent(), "GAME OVER");
  assert.match(await selectedPublicButton.evaluate((element) => getComputedStyle(element).animationName), /warmupChoiceSelected/);
  const selectedOperatorButton = operator.locator('[aria-label="Escolha para começar"] button[data-selected="true"]');
  await selectedOperatorButton.waitFor();
  assert.equal(await selectedOperatorButton.textContent(), "GAME OVER");
  assert.match(await selectedOperatorButton.evaluate((element) => getComputedStyle(element).animationName), /operatorChoiceSelected/);
  await waitForState(context.request, (state) => state.publicMessage?.content === gameOver.comment, "GAME OVER comment");
  await display.getByText(gameOver.comment, { exact: true }).waitFor();
  const ready = await waitForState(
    context.request,
    (state) => state.audienceWarmup.previewPromptId === "play-dead-30",
    "required play-dead prompt"
  );
  const messages = ready.conversation.map((message) => message.content);
  const requiredPrompt = "TODOS FINJAM ESTAR MORTOS NAS CADEIRAS E NO CHÃO.";
  assert(messages.indexOf(gameOver.comment) < messages.indexOf(requiredPrompt));
  assert.equal(ready.audienceWarmup.actionTimer.status, "awaiting_message");
  assert.equal(ready.audienceWarmup.actionTimer.endsAt, null);
  await display.getByText(requiredPrompt, { exact: true }).waitFor();
  const typedAt = Date.now();
  const holding = await waitForState(
    context.request,
    (state) => state.audienceWarmup.actionTimer?.status === "awaiting_start",
    "required action reading hold"
  );
  assert.equal(holding.audienceWarmup.actionTimer.endsAt, null);
  const running = await waitForState(
    context.request,
    (state) => state.audienceWarmup.actionTimer?.status === "running",
    "required action timer"
  );
  assert(Date.now() - typedAt >= AUDIENCE_WARMUP_REQUIRED_TIMER_DELAY_MS - 300);
  assert(running.audienceWarmup.actionTimer.endsAt);

  console.log("audience warmup agreements browser tests passed");
} finally {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } }).catch(() => {});
  await context.close();
  await browser.close();
}
