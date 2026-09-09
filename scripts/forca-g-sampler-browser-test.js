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
  const projectionConflicts = [];
  context.on("response", (response) => {
    if (response.url().endsWith("/api/projection") && response.status() === 409) projectionConflicts.push(response.url());
  });
  const reset = await context.request.post(`${BASE_URL}/api/forca-g-sampler`, { data: { action: "reset" } });
  assert.equal(reset.ok(), true, "sampler should reset before browser test");
  const samplerConfig = await context.request.get(`${BASE_URL}/api/forca-g-sampler`).then((response) => response.json());
  const [firstAudio, secondAudio] = samplerConfig.config.sections.audio;
  const [firstExplanationVideo] = samplerConfig.config.sections.video.filter((item) => (
    item.assetPath.startsWith("videos/explicacoes-sampler/")
  ));
  assert.ok(firstAudio && secondAudio, "scene 2 sampler should expose at least two audio pads");
  assert.ok(firstExplanationVideo, "scene 2 sampler should expose explanation video pads");

  const projection = await context.newPage();
  await projection.goto(`${BASE_URL}/forca-g-samples`, { waitUntil: "domcontentloaded" });
  await projection.getByRole("main", { name: "Projeção do sampler Força G" }).waitFor();

  const controller = await context.newPage();
  await controller.goto(`${BASE_URL}/forca-g-samples-controller`, { waitUntil: "domcontentloaded" });
  await controller.getByRole("heading", { name: "SAMPLER — FORÇA G" }).waitFor();
  await controller.getByRole("region", { name: "G-LOC" }).waitFor();
  await controller.getByText("READY", { exact: true }).waitFor();

  const soundRegion = controller.getByRole("region", { name: "SOM" });
  await clickAndWait(controller, soundRegion.getByRole("button", { name: `Tocar ${firstAudio.label}` }));
  await projection.locator("audio").waitFor({ state: "attached" });
  await projection.waitForFunction(() => {
    const audio = document.querySelector("audio");
    return audio && !audio.paused && audio.readyState >= 2 && audio.currentTime > 0.05;
  }, null, { timeout: 5000 });
  await clickAndWait(controller, soundRegion.getByRole("button", { name: `Parar ${firstAudio.label}` }));

  const isabela = controller.getByRole("button", { name: "Tocar ISABELA" });
  assert.equal(await isabela.isEnabled(), true, "existing G-LOC pad should be enabled");

  const shaderControls = controller.getByRole("region", { name: "Shaders sobre vídeo" });
  await clickAndWait(controller, shaderControls.getByRole("button", { name: "TÚNEL" }));
  await projection.getByRole("img", { name: "Teste de visão em túnel" }).waitFor();
  assert.equal(await projection.locator("video").count(), 0, "tunnel reference should work without video");
  await projection.screenshot({ path: "/private/tmp/forca-g-tunnel.png" });
  await clickAndWait(controller, shaderControls.getByRole("button", { name: "LIMPAR" }));

  await clickAndWait(controller, isabela);
  let state = await samplerState(context.request);
  assert.equal(state.layers.gLoc.id, "g-loc-isabela");
  await projection.locator("video").waitFor();
  assert.equal(await projection.locator("video").count(), 1, "G-LOC should appear on projection");
  await projection.waitForFunction(() => {
    const video = document.querySelector("video");
    return video && !video.paused && video.readyState >= 2 && video.currentTime > 0.05;
  }, null, { timeout: 5000 });

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

  const videoRegion = controller.getByRole("region", { name: "VÍDEO" });
  await clickAndWait(controller, videoRegion.getByRole("button", { name: `Tocar ${firstExplanationVideo.label}` }));
  state = await samplerState(context.request);
  assert.equal(state.layers.video.id, firstExplanationVideo.id, "explanation video pad should update the video layer");
  assert.equal(await projection.locator("video").count(), 2, "explanation video should coexist with the G-LOC layer");
  await projection.waitForFunction((assetPath) => {
    const target = [...document.querySelectorAll("video")].find((video) => decodeURIComponent(video.src).includes(assetPath));
    return target && !target.paused && target.readyState >= 2 && target.currentTime > 0.05;
  }, firstExplanationVideo.assetPath, { timeout: 5000 });
  await clickAndWait(controller, videoRegion.getByRole("button", { name: `Parar ${firstExplanationVideo.label}` }));
  assert.equal((await samplerState(context.request)).layers.video, null, "individual video stop should preserve other layers");

  await shaderControls.getByRole("button", { name: "TÚNEL" }).click();
  await controller.waitForTimeout(120);
  const shaderState = await context.request.get(`${BASE_URL}/api/state`).then((response) => response.json());
  assert.equal(shaderState.forcaGShaders.tunnel, true, "existing shader controls should affect sampler projection");

  await clickAndWait(controller, soundRegion.getByRole("button", { name: `Tocar ${firstAudio.label}` }));
  await clickAndWait(controller, soundRegion.getByRole("button", { name: `Tocar ${secondAudio.label}` }));
  state = await samplerState(context.request);
  assert.equal(state.audioCues.length, 2, "two Scene 2 samples should play simultaneously");
  await clickAndWait(controller, soundRegion.getByRole("button", { name: `Tocar ${firstAudio.label}` }));
  state = await samplerState(context.request);
  assert.equal(state.audioCues.length, 3, "audio pad should retrigger as another voice");
  assert.equal(await projection.locator("audio").count(), 3, "projection should keep all polyphonic voices");
  await projection.waitForFunction(() => (
    [...document.querySelectorAll("audio")].every((audio) => !audio.paused && audio.readyState >= 2 && audio.currentTime > 0.05)
  ), null, { timeout: 5000 });
  await controller.getByRole("region", { name: "Pedais do sample selecionado" }).getByText(firstAudio.label, { exact: true }).waitFor();

  const effectsResponse = await context.request.post(`${BASE_URL}/api/forca-g-sampler`, {
    data: {
      action: "update-audio",
      itemId: firstAudio.id,
      audioEffects: { enabled: true, preset: "radio", echoEnabled: true, echo: 0.12 }
    }
  });
  assert.equal(effectsResponse.ok(), true, "pedal settings should update active voices");
  state = await samplerState(context.request);
  assert.equal(state.audioCues.filter((cue) => cue.id === firstAudio.id).every((cue) => cue.audioEffects.enabled), true);
  assert.equal(
    state.audioCues.find((cue) => cue.id === secondAudio.id).audioEffects.enabled,
    Boolean(secondAudio.audioEffects.enabled),
    "effects must remain per pad"
  );

  await clickAndWait(controller, soundRegion.getByRole("button", { name: `Parar ${firstAudio.label}` }));
  state = await samplerState(context.request);
  assert.deepEqual(state.audioCues.map((cue) => cue.id), [secondAudio.id], "individual stop should preserve the other sample");

  await controller.screenshot({ path: "/private/tmp/forca-g-sampler-controller.png", fullPage: true });
  await clickAndWait(controller, controller.getByRole("button", { name: "STOP ALL", exact: true }));
  state = await samplerState(context.request);
  assert.deepEqual(state.layers, { gLoc: null, video: null, images: [], text: null });
  assert.deepEqual(state.audioCues, []);
  const clearedState = await context.request.get(`${BASE_URL}/api/state`).then((response) => response.json());
  assert.equal(clearedState.forcaGShaders.tunnel, false, "STOP ALL should clear shaders");
  assert.equal(await projection.locator("video").count(), 0, "STOP ALL should remove video");
  assert.equal(await projection.getByText("4G TESTE", { exact: true }).count(), 0, "STOP ALL should remove text");
  assert.deepEqual(projectionConflicts, [], "controller navigation should not call a disconnected projection window");

  console.log("forca-g sampler browser tests passed");
} finally {
  await browser.close();
}
