import assert from "node:assert/strict";
import { chromium } from "playwright";
import { PLAY_UNLOCK_CONFIG } from "../data/scene-zero-unlock.js";

const BASE_URL = process.env.CAIXA_PRETA_URL || "http://localhost:3000";

async function snapshot(request) {
  return (await request.get(`${BASE_URL}/api/state`)).json();
}

async function control(request, action) {
  const response = await request.post(`${BASE_URL}/api/audience-warmup`, {
    data: { action: `unlock-${action}` }
  });
  const data = await response.json();
  assert.equal(response.ok(), true, `${action}: ${data.error || "request failed"}`);
  return data.unlock;
}

async function waitFor(request, predicate, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await snapshot(request);
    if (predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error("timeout waiting for sound-check state");
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addInitScript(() => {
  if (!navigator.mediaDevices) return;
  navigator.mediaDevices.getUserMedia = async () => {
    const count = Number(localStorage.getItem("caixa-preta-mic-test-count") || 0) + 1;
    localStorage.setItem("caixa-preta-mic-test-count", `${count}`);
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const destination = audioContext.createMediaStreamDestination();
    gain.gain.value = 0;
    oscillator.connect(gain).connect(destination);
    oscillator.start();
    window.__audienceSoundCheckTestInput = { audioContext, gain, oscillator };
    return destination.stream;
  };
});

try {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } });

  const projection = await context.newPage();
  await projection.goto(`${BASE_URL}/videomapping`, { waitUntil: "domcontentloaded" });
  const controller = await context.newPage();
  await controller.goto(`${BASE_URL}/cena-0-controller`, { waitUntil: "domcontentloaded" });
  await controller.waitForFunction(() => localStorage.getItem("caixa-preta-mic-test-count") === "1");

  await control(context.request, "boot");
  await control(context.request, "pause-boot");
  let state = await snapshot(context.request);
  while (state.sceneZero.unlock.status === "BOOTING") {
    await control(context.request, "advance-boot");
    state = await snapshot(context.request);
  }
  assert.equal(state.sceneZero.unlock.status, "BOOT_FAILED");
  await control(context.request, "start-warmup");
  await waitFor(context.request, (value) => value.sceneZero.unlock.soundCheck?.phase === "listening", 8000);

  await controller.evaluate(async () => {
    const input = window.__audienceSoundCheckTestInput;
    await input.audioContext.resume();
    await window.__caixaPretaControllerMicrophone?.context?.resume();
    input.gain.gain.value = 0.25;
  });

  await waitFor(context.request, (value) => (
    Number(value.sceneZero.unlock.soundCheck?.liveLevel) >= PLAY_UNLOCK_CONFIG.soundCheck.thresholdPercent
  ), 8000);
  state = await waitFor(context.request, (value) => value.sceneZero.unlock.soundCheck?.phase === "confirmed", 8000);
  assert.equal(state.sceneZero.unlock.soundCheck.completionSource, "microphone");
  assert.equal(state.sceneZero.unlock.progress, PLAY_UNLOCK_CONFIG.soundCheck.progressValue, "a confirmação sonora deve avançar a barra em 5%");
  assert.equal(await controller.evaluate(() => localStorage.getItem("caixa-preta-mic-test-count")), "1");
  await projection.getByText(state.sceneZero.unlock.soundCheck.comment, { exact: true }).waitFor();

  console.log("audience sound-check browser test passed");
} finally {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } }).catch(() => {});
  await context.close();
  await browser.close();
}
