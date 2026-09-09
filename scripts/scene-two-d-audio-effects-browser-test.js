import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = "http://localhost:3000";
const CONTROLLER_ID = "transicao-psicodelica";

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
  const audioCues = initial.config.cues.filter((cue) => cue.type === "audio");
  assert.equal(audioCues.length, 2, "Cena 2D should expose both final audio cues");
  assert.equal(audioCues[0].assetPath.endsWith("19-12-17.m4a"), true, "the 229-second audio should come first");
  assert.equal(audioCues[1].assetPath.endsWith("19-12-26.m4a"), true, "the 31-second audio should come second");

  await context.request.post(`${BASE_URL}/api/controller-cues/play`, {
    data: { controllerId: CONTROLLER_ID, action: "stop-all" }
  });

  const projection = await context.newPage();
  await projection.goto(`${BASE_URL}/transicao-psicodelica`, { waitUntil: "domcontentloaded" });

  const controller = await context.newPage();
  await controller.goto(`${BASE_URL}/transicao-psicodelica-controller`, { waitUntil: "domcontentloaded" });
  await controller.getByRole("heading", { name: "CENA 2D — TRANSIÇÃO PSICODÉLICA" }).waitFor();
  const effects = controller.getByRole("region", { name: "Pedais do sample selecionado" });

  await controller.getByRole("button", { name: `Tocar ${audioCues[0].label}` }).click();
  await effects.getByText(audioCues[0].label, { exact: true }).waitFor();
  await effects.getByRole("button", { name: "RÁDIO" }).click();
  await controller.waitForFunction(async ({ controllerId, cueId }) => {
    const response = await fetch(`/api/controller-cues?id=${controllerId}`, { cache: "no-store" });
    const data = await response.json();
    return data.config?.cues?.find((cue) => cue.id === cueId)?.audioEffects?.preset === "radio";
  }, { controllerId: CONTROLLER_ID, cueId: audioCues[0].id });

  await controller.getByRole("button", { name: `Tocar ${audioCues[1].label}` }).click();
  await effects.getByText(audioCues[1].label, { exact: true }).waitFor();
  await effects.getByRole("button", { name: "DESTRUÍDO" }).click();
  await controller.waitForFunction(async ({ controllerId, cueId }) => {
    const response = await fetch(`/api/controller-cues?id=${controllerId}`, { cache: "no-store" });
    const data = await response.json();
    return data.config?.cues?.find((cue) => cue.id === cueId)?.audioEffects?.preset === "destruido";
  }, { controllerId: CONTROLLER_ID, cueId: audioCues[1].id });

  await projection.locator("audio").nth(1).waitFor({ state: "attached" });
  const state = await context.request.get(`${BASE_URL}/api/state`).then((response) => response.json());
  const active = state.sceneCue?.audioCues?.filter((cue) => cue.controllerId === CONTROLLER_ID) || [];
  assert.equal(active.length, 2, "both Scene 2D audios should remain polyphonic");
  assert.equal(active.find((cue) => cue.id === audioCues[0].id)?.audioEffects?.preset, "radio");
  assert.equal(active.find((cue) => cue.id === audioCues[1].id)?.audioEffects?.preset, "destruido");
  await controller.screenshot({ path: "/private/tmp/scene-two-d-audio-effects.png", fullPage: true });

  console.log("scene two D audio order and pedalboard browser tests passed");
} finally {
  if (context) {
    await context.request.post(`${BASE_URL}/api/controller-cues/play`, {
      data: { controllerId: CONTROLLER_ID, action: "stop-all" }
    }).catch(() => {});
    if (originalConfig) await saveConfig(context.request, originalConfig).catch(() => {});
  }
  await browser.close();
}
