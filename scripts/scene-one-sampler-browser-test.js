import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = "http://localhost:3000";

async function sceneAudioCues(request) {
  const response = await request.get(`${BASE_URL}/api/state`);
  assert.equal(response.ok(), true, "GET /api/state should succeed");
  const state = await response.json();
  return (state.sceneCue?.audioCues || []).filter((cue) => cue.controllerId === "queda-aviao-sampler");
}

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    class FakeAudio {
      constructor(src) {
        this.src = src;
        this.loop = false;
        this.volume = 1;
        this.paused = true;
        this.listeners = new Map();
      }

      addEventListener(name, listener) {
        this.listeners.set(name, listener);
      }

      pause() {
        this.paused = true;
      }

      play() {
        this.paused = false;
        return Promise.resolve();
      }

      removeAttribute(name) {
        if (name === "src") this.src = "";
      }
    }

    window.Audio = FakeAudio;
  });

  const configResponse = await context.request.get(`${BASE_URL}/api/controller-cues?id=queda-aviao-sampler`);
  assert.equal(configResponse.ok(), true, "scene one sampler config should load");
  const configPayload = await configResponse.json();
  assert.equal(configPayload.config.cues.length, 4);
  assert.equal(configPayload.config.cues.every((cue) => cue.assetPath === ""), true);
  assert.equal(configPayload.config.cues.every((cue) => cue.loop === false && cue.volume === 1), true);
  assert.ok(configPayload.assets.audio.length >= 2, "test needs two already-existing repository audio files");
  const [firstAsset, secondAsset] = configPayload.assets.audio;

  const projection = await context.newPage();
  await projection.goto(`${BASE_URL}/queda-aviao`, { waitUntil: "domcontentloaded" });

  const controller = await context.newPage();
  await controller.goto(`${BASE_URL}/queda-aviao-controller`, { waitUntil: "domcontentloaded" });
  const sampler = controller.getByRole("region", { name: "SAMPLER — QUEDA / EMERGÊNCIA" });
  await sampler.getByText("CONFIGURAR SAMPLES / ATALHOS").click();

  const playSample1 = sampler.getByRole("button", { name: "Tocar Sample 1" });
  const playSample2 = sampler.getByRole("button", { name: "Tocar Sample 2" });
  assert.equal(await playSample1.isDisabled(), true, "missing files must disable PLAY");
  assert.equal(await sampler.getByText("SEM ARQUIVO").count(), 4);

  const cueSelector = sampler.getByLabel("Botão a editar");
  const materialSelector = sampler.getByLabel("Material");
  const shortcutInput = sampler.getByLabel("Atalho");

  await materialSelector.selectOption(firstAsset.path);
  await shortcutInput.fill("s");
  await sampler.getByLabel("Volume Sample 1").fill("0");
  const sample1Card = sampler.locator("article").filter({ hasText: "Sample 1" });
  await sample1Card.getByRole("button", { name: "LOOP OFF" }).click();

  await cueSelector.selectOption({ label: "Sample 2" });
  await materialSelector.selectOption(secondAsset.path);
  await shortcutInput.fill("a");
  await sampler.getByLabel("Volume Sample 2").fill("0");
  const sample2Card = sampler.locator("article").filter({ hasText: "Sample 2" });
  await sample2Card.getByRole("button", { name: "LOOP OFF" }).click();

  await playSample1.click();
  await playSample2.click();
  await controller.waitForTimeout(250);
  let audioCues = await sceneAudioCues(context.request);
  assert.equal(audioCues.length, 2, "different samples should play simultaneously");
  assert.equal(audioCues.every((cue) => cue.loop), true, "loops should be independent and active");
  assert.equal(await projection.locator("audio").count(), 2, "projection should receive both audio cues");
  await sample1Card.getByText("TOCANDO").waitFor();
  await sample2Card.getByText("TOCANDO").waitFor();
  await controller.screenshot({ path: "/private/tmp/scene-one-sampler.png", fullPage: true });

  const beforeIndex = (await context.request.get(`${BASE_URL}/api/queda-aviao`).then((response) => response.json())).currentIndex;
  await controller.getByRole("button", { name: "PRÓXIMA" }).click();
  await controller.waitForTimeout(150);
  const afterTextNavigation = await context.request.get(`${BASE_URL}/api/queda-aviao`).then((response) => response.json());
  assert.notEqual(afterTextNavigation.currentIndex, beforeIndex, "text should navigate normally");
  assert.equal((await sceneAudioCues(context.request)).length, 2, "text navigation must not stop samples");

  await sample1Card.getByRole("button", { name: "LOOP ON" }).click();
  await controller.waitForTimeout(150);
  audioCues = await sceneAudioCues(context.request);
  assert.equal(audioCues.find((cue) => cue.id === configPayload.config.cues[0].id)?.loop, false);
  assert.equal(audioCues.find((cue) => cue.id === configPayload.config.cues[1].id)?.loop, true);

  await playSample1.click();
  await controller.locator("h1").click();
  await controller.keyboard.press("s");
  await controller.waitForTimeout(200);
  assert.equal((await sceneAudioCues(context.request)).length, 4, "one-shot click and shortcut should retrigger independently");

  await shortcutInput.focus();
  const beforeTyping = (await sceneAudioCues(context.request)).length;
  await controller.keyboard.press("s");
  await controller.waitForTimeout(100);
  assert.equal((await sceneAudioCues(context.request)).length, beforeTyping, "shortcuts must not fire while typing");

  await sample1Card.getByRole("button", { name: "Parar Sample 1" }).click();
  await controller.waitForTimeout(150);
  audioCues = await sceneAudioCues(context.request);
  assert.equal(audioCues.length, 1, "per-sample STOP should leave other samples playing");
  assert.equal(audioCues[0].id, configPayload.config.cues[1].id);

  const currentIndexBeforeStopAll = (await context.request.get(`${BASE_URL}/api/queda-aviao`).then((response) => response.json())).currentIndex;
  await sampler.getByRole("button", { name: "SILÊNCIO / STOP ALL" }).click();
  await controller.waitForTimeout(150);
  assert.equal((await sceneAudioCues(context.request)).length, 0, "STOP ALL should clear every scene one sample");
  const currentIndexAfterStopAll = (await context.request.get(`${BASE_URL}/api/queda-aviao`).then((response) => response.json())).currentIndex;
  assert.equal(currentIndexAfterStopAll, currentIndexBeforeStopAll, "STOP ALL must not change the text scene");
  assert.equal(await projection.locator("audio").count(), 0, "projection audio elements should be cleared");

  await controller.reload({ waitUntil: "domcontentloaded" });
  await controller.getByRole("region", { name: "SAMPLER — QUEDA / EMERGÊNCIA" }).waitFor();
  assert.equal(await controller.getByText("SEM ARQUIVO").count(), 4, "reload should keep the safe empty default config");

  const existingControllers = [
    ["/forca-g-samples-controller", "CENA 2A — FORÇA G / SAMPLES AUDIOVISUAIS"],
    ["/forca-g-shaders-controller", "CENA 2B — FORÇA G / VÍDEOS E SHADERS"],
    ["/transicao-psicodelica-controller", "CENA 2D — TRANSIÇÃO PSICODÉLICA"],
    ["/tea-for-two-controller", "CENA 3 — TEA FOR TWO / TRANSIÇÃO"],
    ["/piloto-videogame-controller", "CENA 4 — PILOTO / SONS DE VIDEOGAME"],
    ["/tecnologia-floresta-controller", "CAMADA — TECNOLOGIA × FLORESTA"]
  ];

  for (const [path, title] of existingControllers) {
    await controller.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
    await controller.getByRole("heading", { name: title }).waitFor();
    await controller.getByRole("button", { name: "SILÊNCIO / STOP ALL" }).waitFor();
  }

  console.log("scene one sampler browser tests passed");
} finally {
  await browser.close();
}
