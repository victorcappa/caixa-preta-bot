import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = "http://localhost:3000";

async function samplerState(request) {
  const response = await request.get(`${BASE_URL}/api/state`);
  assert.equal(response.ok(), true);
  return (await response.json()).forcaGSampler;
}

async function clickAndWait(page, button) {
  const responsePromise = page.waitForResponse((response) => (
    response.url().endsWith("/api/forca-g-sampler") && response.request().method() === "POST"
  ));
  const [response] = await Promise.all([responsePromise, button.click()]);
  assert.equal(response.ok(), true, `sampler action should succeed: ${await response.text()}`);
}

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext();
  const reset = await context.request.post(`${BASE_URL}/api/forca-g-sampler`, { data: { action: "reset" } });
  assert.equal(reset.ok(), true, "sampler should reset before browser test");

  const projection = await context.newPage();
  await projection.goto(`${BASE_URL}/forca-g-samples`, { waitUntil: "domcontentloaded" });
  await projection.getByRole("main", { name: "Projeção do sampler Força G" }).waitFor();

  const controller = await context.newPage();
  await controller.goto(`${BASE_URL}/forca-g-samples-controller`, { waitUntil: "domcontentloaded" });
  await controller.getByRole("heading", { name: "SAMPLER — FORÇA G" }).waitFor();
  await controller.getByRole("region", { name: "G-LOC" }).waitFor();
  await controller.getByText("READY", { exact: true }).waitFor();

  const isabela = controller.getByRole("button", { name: "Tocar ISABELA" });
  assert.equal(await isabela.isEnabled(), true, "existing G-LOC pad should be enabled");
  await clickAndWait(controller, isabela);
  let state = await samplerState(context.request);
  assert.equal(state.layers.gLoc.id, "g-loc-isabela");
  await projection.locator("video").waitFor();
  assert.equal(await projection.locator("video").count(), 1, "G-LOC should appear on projection");

  const beforeRestart = state.layers.gLoc.playbackId;
  const gLocRegion = controller.getByRole("region", { name: "G-LOC" });
  await clickAndWait(controller, gLocRegion.getByRole("button", { name: "LOOP OFF" }));
  await clickAndWait(controller, gLocRegion.getByRole("button", { name: "REINICIAR" }));
  state = await samplerState(context.request);
  assert.equal(state.layers.gLoc.loop, true, "global loop should update current G-LOC");
  assert.notEqual(state.layers.gLoc.playbackId, beforeRestart, "restart should create a new playback");

  const freeText = controller.getByLabel("Texto livre");
  await freeText.fill("4G TESTE");
  await clickAndWait(controller, controller.getByRole("button", { name: "DISPARAR TEXTO" }));
  await projection.getByText("4G TESTE", { exact: true }).waitFor();
  assert.equal(await projection.locator("video").count(), 1, "text should overlay video without stopping it");

  await freeText.focus();
  await controller.keyboard.press("2");
  await controller.waitForTimeout(120);
  assert.equal((await samplerState(context.request)).layers.gLoc.id, "g-loc-isabela", "hotkeys must not trigger while typing");

  await controller.getByRole("heading", { name: "SAMPLER — FORÇA G" }).click();
  const hotkeyResponse = controller.waitForResponse((response) => response.url().endsWith("/api/forca-g-sampler") && response.request().method() === "POST");
  await controller.keyboard.press("2");
  assert.equal((await hotkeyResponse).ok(), true);
  assert.equal((await samplerState(context.request)).layers.gLoc.id, "g-loc-robinson", "configured hotkey should trigger pad");

  await controller.getByRole("region", { name: "Shaders sobre vídeo" }).getByRole("button", { name: "TÚNEL" }).click();
  await controller.waitForTimeout(120);
  const shaderState = await context.request.get(`${BASE_URL}/api/state`).then((response) => response.json());
  assert.equal(shaderState.forcaGShaders.tunnel, true, "existing shader controls should affect sampler projection");

  await controller.screenshot({ path: "/private/tmp/forca-g-sampler-controller.png", fullPage: true });
  await clickAndWait(controller, controller.getByRole("button", { name: "STOP ALL", exact: true }));
  state = await samplerState(context.request);
  assert.deepEqual(state.layers, { gLoc: null, video: null, images: [], text: null });
  assert.deepEqual(state.audioCues, []);
  const clearedState = await context.request.get(`${BASE_URL}/api/state`).then((response) => response.json());
  assert.equal(clearedState.forcaGShaders.tunnel, false, "STOP ALL should clear shaders");
  assert.equal(await projection.locator("video").count(), 0, "STOP ALL should remove video");
  assert.equal(await projection.getByText("4G TESTE", { exact: true }).count(), 0, "STOP ALL should remove text");

  console.log("forca-g sampler browser tests passed");
} finally {
  await browser.close();
}
