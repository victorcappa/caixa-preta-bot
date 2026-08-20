import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = "http://localhost:3000";
const CONTROLLER_ID = "queda-aviao-sampler";

async function cueConfig(request) {
  const response = await request.get(`${BASE_URL}/api/controller-cues?id=${CONTROLLER_ID}`);
  assert.equal(response.ok(), true);
  return response.json();
}

async function saveConfig(request, config) {
  const response = await request.put(`${BASE_URL}/api/controller-cues`, {
    data: { id: CONTROLLER_ID, config }
  });
  assert.equal(response.ok(), true);
}

const browser = await chromium.launch({ headless: true });
let context = null;
let originalConfig = null;

try {
  context = await browser.newContext();
  const initial = await cueConfig(context.request);
  originalConfig = initial.config;
  const availablePaths = new Set((initial.assets?.audio || []).map((asset) => asset.path));
  const playableCues = initial.config.cues.filter((cue) => availablePaths.has(cue.assetPath));
  assert.ok(playableCues.length >= 2, "the per-sample effects test needs two playable scene one audios");
  const [firstCue, secondCue] = playableCues;
  await saveConfig(context.request, {
    ...originalConfig,
    cues: originalConfig.cues.map((cue) => (
      cue.id === firstCue.id || cue.id === secondCue.id ? { ...cue, loop: true } : cue
    ))
  });

  await context.request.post(`${BASE_URL}/api/controller-cues/play`, {
    data: { controllerId: CONTROLLER_ID, action: "stop-all" }
  });

  const projection = await context.newPage();
  await projection.goto(`${BASE_URL}/queda-aviao`, { waitUntil: "domcontentloaded" });

  const controller = await context.newPage();
  await controller.goto(`${BASE_URL}/queda-aviao-controller`, { waitUntil: "domcontentloaded" });
  const effects = controller.getByRole("region", { name: "Pedais do sample selecionado" });

  await controller.getByRole("button", { name: `Tocar ${firstCue.label}` }).click();
  await effects.getByText(firstCue.label, { exact: true }).waitFor();
  await effects.getByRole("button", { name: "RÁDIO" }).click();
  await controller.waitForFunction(async ({ controllerId, cueId }) => {
    const response = await fetch(`/api/controller-cues?id=${controllerId}`, { cache: "no-store" });
    const data = await response.json();
    return data.config?.cues?.find((cue) => cue.id === cueId)?.audioEffects?.preset === "radio";
  }, { controllerId: CONTROLLER_ID, cueId: firstCue.id });

  await controller.getByRole("button", { name: `Tocar ${secondCue.label}` }).click();
  await effects.getByText(secondCue.label, { exact: true }).waitFor();
  await effects.getByRole("button", { name: "DESTRUÍDO" }).click();
  await controller.waitForFunction(async ({ controllerId, cueId }) => {
    const response = await fetch(`/api/controller-cues?id=${controllerId}`, { cache: "no-store" });
    const data = await response.json();
    return data.config?.cues?.find((cue) => cue.id === cueId)?.audioEffects?.preset === "destruido";
  }, { controllerId: CONTROLLER_ID, cueId: secondCue.id });

  await controller.getByRole("button", { name: `Tocar ${firstCue.label}` }).click();
  await effects.getByRole("button", { name: "RÁDIO", pressed: true }).waitFor();
  await effects.getByRole("slider", { name: "PHASER INTENSIDADE" }).fill("0.81");
  await controller.waitForFunction(async ({ controllerId, cueId }) => {
    const response = await fetch(`/api/controller-cues?id=${controllerId}`, { cache: "no-store" });
    const data = await response.json();
    const settings = data.config?.cues?.find((cue) => cue.id === cueId)?.audioEffects;
    return settings?.preset === "custom" && settings?.phaserEnabled === true
      && Math.abs(settings.phaser - 0.81) < 0.001;
  }, { controllerId: CONTROLLER_ID, cueId: firstCue.id });

  await projection.reload({ waitUntil: "domcontentloaded" });
  await projection.locator("audio").nth(1).waitFor({ state: "attached" });

  const saved = await cueConfig(context.request);
  assert.equal(saved.config.cues.find((cue) => cue.id === firstCue.id).audioEffects.phaser, 0.81);
  assert.equal(saved.config.cues.find((cue) => cue.id === secondCue.id).audioEffects.preset, "destruido");

  await controller.getByRole("button", { name: `Fade out ${firstCue.label}` }).click();
  await controller.waitForFunction(async ({ controllerId, firstCueId, secondCueId }) => {
    const response = await fetch("/api/state", { cache: "no-store" });
    const state = await response.json();
    const active = state.sceneCue?.audioCues || [];
    return !active.some((cue) => cue.controllerId === controllerId && cue.id === firstCueId)
      && active.some((cue) => cue.controllerId === controllerId && cue.id === secondCueId);
  }, { controllerId: CONTROLLER_ID, firstCueId: firstCue.id, secondCueId: secondCue.id });
  await projection.waitForFunction(() => document.querySelectorAll("audio").length === 1);
  console.log("scene one per-sample pedalboard browser tests passed");
} finally {
  if (context) {
    await context.request.post(`${BASE_URL}/api/controller-cues/play`, {
      data: { controllerId: CONTROLLER_ID, action: "stop-all" }
    }).catch(() => {});
    if (originalConfig) await saveConfig(context.request, originalConfig).catch(() => {});
  }
  await browser.close();
}
