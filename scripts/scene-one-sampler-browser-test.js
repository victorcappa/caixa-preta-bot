import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = "http://localhost:3000";
const SCENE_ONE_AUDIO_DIRECTORY = path.join(process.cwd(), "assets", "audios", "queda-aviao");

async function sceneAudioCues(request) {
  const response = await request.get(`${BASE_URL}/api/state`);
  assert.equal(response.ok(), true, "GET /api/state should succeed");
  const state = await response.json();
  return (state.sceneCue?.audioCues || []).filter((cue) => cue.controllerId === "queda-aviao-sampler");
}

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext();
  const resetResponse = await context.request.post(`${BASE_URL}/api/controller-cues/play`, {
    data: { controllerId: "queda-aviao-sampler", action: "stop-all" }
  });
  assert.equal(resetResponse.ok(), true, "scene one sampler state should reset before the test");

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
  const expectedFilenames = fs.readdirSync(SCENE_ONE_AUDIO_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isFile() && [".mp3", ".wav", ".ogg", ".m4a"].includes(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));
  const expectedBasePaths = expectedFilenames.map((filename) => `audios/queda-aviao/${filename}`);
  assert.ok(expectedBasePaths.length >= 1, "scene one base audio directory should not be empty");
  const configuredPaths = new Set(configPayload.config.cues.map((cue) => cue.assetPath));
  assert.equal(expectedBasePaths.every((assetPath) => configuredPaths.has(assetPath)), true, "folder audios should be present without removing additional saved pads");
  for (const filename of expectedFilenames) {
    const assetPath = `audios/queda-aviao/${filename}`;
    assert.equal(
      configPayload.config.cues.find((cue) => cue.assetPath === assetPath)?.label,
      path.basename(filename, path.extname(filename))
    );
  }
  assert.equal(configPayload.config.cues.every((cue) => typeof cue.loop === "boolean" && cue.volume >= 0 && cue.volume <= 1), true);
  assert.equal(expectedBasePaths.every((assetPath) => configPayload.assets.audio.some((asset) => asset.path === assetPath)), true);
  const [firstCue, secondCue] = configPayload.config.cues;

  const projection = await context.newPage();
  await projection.goto(`${BASE_URL}/queda-aviao`, { waitUntil: "domcontentloaded" });

  const controller = await context.newPage();
  await controller.goto(`${BASE_URL}/queda-aviao-controller`, { waitUntil: "domcontentloaded" });
  const sampler = controller.getByRole("region", { name: "SAMPLER — QUEDA / EMERGÊNCIA" });
  await sampler.getByText("CONFIGURAR SAMPLES / ATALHOS").click();

  const cueSelector = sampler.getByLabel("Botão a editar");
  const materialSelector = sampler.getByLabel("Arquivo de áudio");
  const shortcutInput = sampler.getByLabel("Atalho");

  await sampler.getByRole("button", { name: "NOVO BOTÃO" }).click();
  const emptyCue = sampler.getByRole("button", { name: "Tocar Novo Botão" });
  assert.equal(await emptyCue.isDisabled(), true, "a newly-created cue without a file must disable PLAY");
  assert.equal(await sampler.getByText("SEM ARQUIVO").count(), 1);
  await materialSelector.selectOption(expectedBasePaths[2]);
  assert.equal(await emptyCue.isEnabled(), true, "the editor must let a new button receive an existing audio file");

  await cueSelector.selectOption({ label: firstCue.label });
  await shortcutInput.fill("s");
  await sampler.getByLabel(`Volume ${firstCue.label}`).fill("0");
  const sample1Card = sampler.locator("article").filter({ hasText: firstCue.label });
  await sample1Card.getByRole("button", { name: "LOOP OFF" }).click();

  await cueSelector.selectOption({ label: secondCue.label });
  await shortcutInput.fill("a");
  await sampler.getByLabel(`Volume ${secondCue.label}`).fill("0");
  const sample2Card = sampler.locator("article").filter({ hasText: secondCue.label });
  await sample2Card.getByRole("button", { name: "LOOP OFF" }).click();

  const playSample1 = sampler.getByRole("button", { name: `Tocar ${firstCue.label}` });
  const playSample2 = sampler.getByRole("button", { name: `Tocar ${secondCue.label}` });

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

  const beforeArrowIndex = afterTextNavigation.currentIndex;
  await controller.locator("h1").click();
  await controller.keyboard.press("ArrowRight");
  await controller.waitForTimeout(150);
  const afterArrowNavigation = await context.request.get(`${BASE_URL}/api/queda-aviao`).then((response) => response.json());
  assert.notEqual(afterArrowNavigation.currentIndex, beforeArrowIndex, "ArrowRight should advance to the next segment");
  assert.equal((await sceneAudioCues(context.request)).length, 2, "ArrowRight navigation must not stop samples");

  await controller.keyboard.press("ArrowLeft");
  await controller.waitForTimeout(150);
  const afterLeftArrowNavigation = await context.request.get(`${BASE_URL}/api/queda-aviao`).then((response) => response.json());
  assert.equal(afterLeftArrowNavigation.currentIndex, beforeArrowIndex, "ArrowLeft should return to the previous segment");
  assert.equal((await sceneAudioCues(context.request)).length, 2, "ArrowLeft navigation must not stop samples");

  await sample1Card.getByRole("button", { name: "LOOP ON" }).click();
  await controller.waitForTimeout(150);
  audioCues = await sceneAudioCues(context.request);
  assert.equal(audioCues.find((cue) => cue.label === firstCue.label)?.loop, false);
  assert.equal(audioCues.find((cue) => cue.label === secondCue.label)?.loop, true);

  await playSample1.click();
  await controller.locator("h1").click();
  await controller.keyboard.press("s");
  await controller.waitForTimeout(200);
  assert.equal((await sceneAudioCues(context.request)).length, 4, "one-shot click and shortcut should retrigger independently");

  await shortcutInput.focus();
  const beforeTyping = (await sceneAudioCues(context.request)).length;
  const beforeTypingIndex = (await context.request.get(`${BASE_URL}/api/queda-aviao`).then((response) => response.json())).currentIndex;
  await controller.keyboard.press("s");
  await controller.keyboard.press("ArrowRight");
  await controller.keyboard.press("ArrowLeft");
  await controller.waitForTimeout(100);
  assert.equal((await sceneAudioCues(context.request)).length, beforeTyping, "shortcuts must not fire while typing");
  assert.equal(
    (await context.request.get(`${BASE_URL}/api/queda-aviao`).then((response) => response.json())).currentIndex,
    beforeTypingIndex,
    "arrow navigation must not change segments while editing a field"
  );

  await sample1Card.getByRole("button", { name: `Parar ${firstCue.label}` }).click();
  await controller.waitForTimeout(150);
  audioCues = await sceneAudioCues(context.request);
  assert.equal(audioCues.length, 1, "per-sample STOP should leave other samples playing");
  assert.equal(audioCues[0].label, secondCue.label);

  const currentIndexBeforeStopAll = (await context.request.get(`${BASE_URL}/api/queda-aviao`).then((response) => response.json())).currentIndex;
  await sampler.getByRole("button", { name: "SILÊNCIO / STOP ALL" }).click();
  await controller.waitForTimeout(150);
  assert.equal((await sceneAudioCues(context.request)).length, 0, "STOP ALL should clear every scene one sample");
  const currentIndexAfterStopAll = (await context.request.get(`${BASE_URL}/api/queda-aviao`).then((response) => response.json())).currentIndex;
  assert.equal(currentIndexAfterStopAll, currentIndexBeforeStopAll, "STOP ALL must not change the text scene");
  assert.equal(await projection.locator("audio").count(), 0, "projection audio elements should be cleared");

  await controller.reload({ waitUntil: "domcontentloaded" });
  await controller.getByRole("region", { name: "SAMPLER — QUEDA / EMERGÊNCIA" }).waitFor();
  assert.equal(await controller.getByText("SEM ARQUIVO").count(), 0, "reload should restore every configured base file");
  for (const cue of configPayload.config.cues) {
    await controller.getByRole("button", { name: `Tocar ${cue.label}` }).waitFor();
  }

  const existingControllers = [
    ["/forca-g-samples-controller", "SAMPLER — FORÇA G"],
    ["/transicao-psicodelica-controller", "CENA 2D — TRANSIÇÃO PSICODÉLICA"],
    ["/tea-for-two-controller", "CENA 3 — TEA FOR TWO / TRANSIÇÃO"],
    ["/piloto-videogame-controller", "CENA 4 — PILOTO / SONS DE VIDEOGAME"],
    ["/tecnologia-floresta-controller", "CAMADA — TECNOLOGIA × FLORESTA"]
  ];

  for (const [path, title] of existingControllers) {
    await controller.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
    await controller.getByRole("heading", { name: title }).waitFor();
    if (path === "/forca-g-samples-controller") {
      await controller.getByRole("button", { name: "STOP ALL", exact: true }).waitFor();
    } else {
      await controller.getByRole("button", { name: "SILÊNCIO / STOP ALL" }).waitFor();
    }
  }

  console.log("scene one sampler browser tests passed");
} finally {
  await browser.close();
}
