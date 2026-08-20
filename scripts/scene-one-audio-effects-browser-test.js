import assert from "node:assert/strict";
import { chromium } from "playwright";
import {
  SCENE_AUDIO_EFFECT_DEFAULTS,
  SCENE_AUDIO_EFFECTS_CONTROLLER_ID,
  sceneAudioEffectPreset
} from "../lib/sceneAudioEffects.js";

const BASE_URL = "http://localhost:3000";

async function effectState(request) {
  const response = await request.get(`${BASE_URL}/api/state`);
  assert.equal(response.ok(), true);
  const state = await response.json();
  return state.sceneAudioEffects?.[SCENE_AUDIO_EFFECTS_CONTROLLER_ID];
}

async function setEffects(request, settings) {
  const response = await request.post(`${BASE_URL}/api/controller-cues/play`, {
    data: {
      controllerId: SCENE_AUDIO_EFFECTS_CONTROLLER_ID,
      action: "audio-effects",
      settings
    }
  });
  assert.equal(response.ok(), true);
}

const browser = await chromium.launch({ headless: true });
let context = null;
let originalEffects = null;

try {
  context = await browser.newContext();

  originalEffects = await effectState(context.request);
  await setEffects(context.request, sceneAudioEffectPreset("clean", SCENE_AUDIO_EFFECT_DEFAULTS));

  const configResponse = await context.request.get(`${BASE_URL}/api/controller-cues?id=${SCENE_AUDIO_EFFECTS_CONTROLLER_ID}`);
  const configPayload = await configResponse.json();
  const availablePaths = new Set((configPayload.assets?.audio || []).map((asset) => asset.path));
  const playableCue = configPayload.config.cues.find((cue) => availablePaths.has(cue.assetPath));
  assert.ok(playableCue, "the effects test needs one playable scene one audio");

  const projection = await context.newPage();
  await projection.goto(`${BASE_URL}/queda-aviao`, { waitUntil: "domcontentloaded" });

  const controller = await context.newPage();
  await controller.goto(`${BASE_URL}/queda-aviao-controller`, { waitUntil: "domcontentloaded" });
  const effects = controller.getByRole("region", { name: "Distorção do som da Cena 1" });
  await effects.getByRole("button", { name: "RÁDIO" }).click();
  await controller.waitForFunction(async () => {
    const response = await fetch("/api/state");
    const state = await response.json();
    const settings = state.sceneAudioEffects?.["queda-aviao-sampler"];
    return settings?.enabled === true && settings?.preset === "radio";
  });

  await controller.getByRole("button", { name: `Tocar ${playableCue.label}` }).click();
  await controller.waitForFunction(async () => {
    const response = await fetch("/api/state");
    const state = await response.json();
    return state.sceneCue?.audioCues?.some((cue) => (
      cue.controllerId === "queda-aviao-sampler" && cue.assetPath
    ));
  });
  await projection.reload({ waitUntil: "domcontentloaded" });
  await projection.locator("audio").first().waitFor({ state: "attached" });

  await effects.getByRole("slider", { name: "DISTORÇÃO" }).fill("0.83");
  await controller.waitForFunction(async () => {
    const response = await fetch("/api/state");
    const state = await response.json();
    const settings = state.sceneAudioEffects?.["queda-aviao-sampler"];
    return settings?.preset === "custom"
      && settings?.enabled === true
      && Math.abs((settings.drive || 0) - 0.83) < 0.001;
  });

  await effects.getByRole("button", { name: "LIMPO" }).click();
  await controller.waitForFunction(async () => {
    const response = await fetch("/api/state");
    const state = await response.json();
    return state.sceneAudioEffects?.["queda-aviao-sampler"]?.enabled === false;
  });

  await context.request.post(`${BASE_URL}/api/controller-cues/play`, {
    data: { controllerId: SCENE_AUDIO_EFFECTS_CONTROLLER_ID, action: "stop-all" }
  });
  console.log("scene one audio effects browser tests passed");
} finally {
  if (context && originalEffects) {
    await setEffects(context.request, originalEffects).catch(() => {});
  }
  await browser.close();
}
