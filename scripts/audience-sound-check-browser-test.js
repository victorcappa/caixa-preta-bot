import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

const backgroundTest = process.env.CAIXA_PRETA_BACKGROUND_MIC === "1";
let browserProcess;
let browser;
let context;
if (backgroundTest) {
  // A temporary Chromium profile connected without Playwright's focus emulation.
  // Default Playwright pages report visible even when another tab is selected.
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "caixa-microphone-browser-"));
  browserProcess = spawn(chromium.executablePath(), [`--user-data-dir=${profile}`, "--remote-debugging-port=0",
    "--use-mock-keychain", "--password-store=basic",
    "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
  let port;
  const until = Date.now() + 15000;
  while (!port && Date.now() < until) {
    try { port = (await fs.readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]; } catch {}
    if (!port) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(port, "isolated native Chromium must start");
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { noDefaults: true });
  context = browser.contexts()[0];
} else {
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
}
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
  const ending = await control(context.request, "end-bios");
  assert.equal(ending.bootProgress, 100);
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
  if (!backgroundTest) await projection.getByText(state.sceneZero.unlock.soundCheck.comment, { exact: true }).waitFor();

  await controller.evaluate(() => {
    window.__audienceSoundCheckTestInput.gain.gain.value = 0;
  });
  if (backgroundTest) {
    const returned = await context.request.post(`${BASE_URL}/api/scene-zero`, { data: { action: "return-to-sound-check" } });
    assert(returned.ok());
  } else await controller.getByRole("link", { name: /ESCUTA DE DECIBÉIS/ }).click();
  state = await waitFor(context.request, (value) => value.sceneZero.unlock.soundCheck?.phase === "listening", 8000);
  assert.equal(state.sceneZero.unlock.bootProgress, 100);
  assert.equal(state.sceneZero.unlock.bootComplete, true);
  assert.equal(state.sceneZero.unlock.progress, 0);

  if (backgroundTest) {
    await controller.evaluate(() => {
      // A regression test must not accidentally rely on Chromium keeping paint callbacks alive.
      window.requestAnimationFrame = () => 0;
    });
    for (const surface of ["tab", "window"]) {
      if (surface === "window") {
        await controller.evaluate(() => { window.__audienceSoundCheckTestInput.gain.gain.value = 0; });
        const returned = await context.request.post(`${BASE_URL}/api/scene-zero`, { data: { action: "return-to-sound-check" } });
        assert(returned.ok());
        await waitFor(context.request, (value) => value.sceneZero.unlock.soundCheck?.phase === "listening", 8000);
      }
      let destination = projection;
      if (surface === "window") {
        const pageCreated = context.waitForEvent("page");
        const browserSession = await browser.newBrowserCDPSession();
        await browserSession.send("Target.createTarget", { url: `${BASE_URL}/`, newWindow: true });
        destination = await pageCreated;
        await destination.waitForLoadState("domcontentloaded");
        await browserSession.detach();
      }
      await destination.bringToFront();
      await new Promise((resolve) => setTimeout(resolve, 300));
      const focus = await controller.evaluate(() => ({ visibility: document.visibilityState, focused: document.hasFocus() }));
      if (surface === "tab") assert.equal(focus.visibility, "hidden", "Operator tab must really be hidden");
      else assert.equal(focus.focused, false, "Operator must not have focus when the other window is active");
      await new Promise((resolve) => setTimeout(resolve, 500));
      const silent = await snapshot(context.request);
      assert.equal(silent.sceneZero.unlock.soundCheck.phase, "listening", "silence cannot confirm the sound check");
      await controller.evaluate(() => { window.__audienceSoundCheckTestInput.gain.gain.value = 0.25; });
      state = await waitFor(context.request, (value) => value.sceneZero.unlock.soundCheck?.phase === "confirmed", 8000);
      assert.equal(state.sceneZero.unlock.soundCheck.completionSource, "microphone");
      const capture = await controller.evaluate(() => ({ mode: window.__caixaPretaControllerMicrophone.meterMode,
        tracks: window.__caixaPretaControllerMicrophone.stream.getAudioTracks().map((track) => track.readyState),
        requests: localStorage.getItem("caixa-preta-mic-test-count"), visibility: document.visibilityState, focused: document.hasFocus() }));
      assert.equal(capture.mode, "audio-worklet");
      assert.deepEqual(capture.tracks, ["live"]);
      assert.equal(capture.requests, "1");
      if (surface === "tab") assert.equal(capture.visibility, "hidden");
      else assert.equal(capture.focused, false);
      console.log(`PASS microphone with another ${surface} active, Operator ${capture.visibility}, no requestAnimationFrame, same capture, synthetic audio`);
      if (surface === "window") await destination.close();
    }
  }

  console.log("audience sound-check browser test passed: microphone completion and return navigation");
} finally {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } }).catch(() => {});
  await context.close();
  await browser.close();
  browserProcess?.kill("SIGTERM");
}
