import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createInitialSceneZeroState } from "../lib/scene-zero/state.js";
import { createInitialAudienceWarmupState, createAudienceWarmupSequence } from "../lib/audienceWarmup.js";
import { ROBOT_SOUND_DEFAULTS } from "../lib/robot-sound/state.js";

// Every API and the realtime worker are simulated. The sample is an explicitly
// resolved Promise, so these checks produce no audio and never change a show.
const baseUrl = process.env.CAIXA_PRETA_URL || "http://localhost:3000";
const prompt = {
  id: "atualidades-pandemia-cibernetica",
  text: "SE UMA PANDEMIA CIBERNÉTICA DERRUBASSE A INTERNET, QUEM SABERIA VOLTAR PARA CASA SEM GPS LEVANTA A MÃO.",
  action: "hand", category: "atualidades", intensity: "provocative",
  interactionType: "conditional", tags: ["ataque cibernético"], reaction: false
};
const sceneZero = createInitialSceneZeroState();
sceneZero.unlock.status = "WARMING_AUDIENCE";
let state = {
  revision: 1, sceneZero, publicMessage: null, conversation: [], globalVolume: 0.7,
  robotSound: { ...ROBOT_SOUND_DEFAULTS, enabled: true, typingIntervalMs: 4, typingPauseMs: 0, messageGapMs: 0 },
  audienceWarmup: createInitialAudienceWarmupState(),
  performance: { activities: [], events: [] }, projection: { windows: [] }
};
const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  context.setDefaultTimeout(15000);
  await context.addInitScript(() => {
    window.__alertWorkers = [];
    window.__alertCalls = [];
    window.__alertFinishes = [];
    window.SharedWorker = class {
      constructor() {
        this.port = { postMessage() {}, close() {} };
        window.__alertWorkers.push(this);
      }
    };
    let soundEngine;
    Object.defineProperty(window, "__caixaPretaRobotSoundEngine", {
      configurable: true,
      get: () => soundEngine,
      set(engine) {
        soundEngine = engine;
        for (const effect of ["wake", "typing", "complete", "success", "error", "startThinking", "stopThinking"]) engine[effect] = () => {};
        engine.prepareCivilDefenseAlert = async () => ({ duration: 2.02 });
        engine.civilDefenseAlert = (options) => {
          window.__alertCalls.push(options);
          return new Promise((resolve) => window.__alertFinishes.push(() => resolve(true)));
        };
      }
    });
  });
  await context.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    await route.fulfill({ json: pathname === "/api/state"
      ? state
      : { sceneZero: state.sceneZero, state, message: "SIMULAÇÃO" } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  async function ready() {
    await page.waitForFunction(() => window.__caixaPretaRobotSoundEngine
      && window.__alertWorkers.some((worker) => worker.port.onmessage));
  }
  async function publish(eventType = "snapshot") {
    state = { ...state, revision: state.revision + 1 };
    await page.evaluate(({ nextState, type }) => {
      for (const worker of window.__alertWorkers) {
        worker.port.onmessage?.({ data: { type: "payload", payload: { event: { type }, state: nextState } } });
      }
    }, { nextState: state, type: eventType });
  }
  async function question(id) {
    const message = { id, role: "assistant", source: "audience-warmup", content: prompt.text };
    state = {
      ...state, publicMessage: message, conversation: [...state.conversation, message],
      audienceWarmup: {
        ...state.audienceWarmup, phase: "questions", manualMode: true,
        preview: prompt.text, previewPromptId: prompt.id, previewPrompt: prompt,
        sequence: createAudienceWarmupSequence({ ...prompt, promptId: prompt.id }), currentStep: 0,
        display: { messageId: id, text: prompt.text, action: prompt.action, actionLabel: "Levantar a mão", kind: "instruction" }
      }
    };
    await publish("message");
  }
  const speech = page.getByRole("main", { name: "Fala atual da Caixa Preta" });
  async function expectWaiting(callCount) {
    await page.waitForFunction((count) => window.__alertCalls.length === count, callCount);
    assert.equal((await speech.locator("p").innerText()).trim(), "_", "o cursor deve aparecer antes da primeira letra");
    assert.equal(await speech.getByText("Levantar a mão", { exact: true }).count(), 0, "a instrução corporal espera o fim do som");
    const animation = await speech.locator("p span").evaluate((cursor) => ({
      name: getComputedStyle(cursor).animationName, duration: getComputedStyle(cursor).animationDuration
    }));
    assert.notEqual(animation.name, "none", "o cursor deve piscar durante o alerta");
    assert.notEqual(animation.duration, "0s");
  }
  async function finishAlert(index) {
    await page.evaluate((position) => window.__alertFinishes[position](), index);
  }
  async function nextFrames() {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await ready();
  await page.getByLabel("Cursor da Caixa Preta", { exact: true }).waitFor();
  await question("alert-first");
  await expectWaiting(1);
  await publish();
  await nextFrames();
  assert.equal(await page.evaluate(() => window.__alertCalls.length), 1, "snapshot repetido não toca outro pulso");
  await expectWaiting(1);
  await finishAlert(0);
  await speech.getByText(prompt.text, { exact: true }).waitFor();
  await publish();
  await nextFrames();
  assert.equal(await page.evaluate(() => window.__alertCalls.length), 1, "fim da pergunta não repete o pulso");

  await question("alert-repeat");
  await expectWaiting(2);
  await finishAlert(1);
  await speech.getByText(prompt.text, { exact: true }).waitFor();

  await question("alert-stopped");
  await expectWaiting(3);
  await publish("stop-all");
  await finishAlert(2);
  await nextFrames();
  await page.waitForTimeout(120);
  assert.equal((await speech.locator("p").innerText()).trim(), "_", "STOP ALL não pode liberar a pergunta após o som cancelado");

  await question("alert-replaced");
  await expectWaiting(4);
  const replacement = { id: "replacement", role: "assistant", source: "manual", content: "A PRÓXIMA FALA." };
  state = { ...state, publicMessage: replacement, conversation: [...state.conversation, replacement] };
  await publish("message");
  await speech.getByText(replacement.content, { exact: true }).waitFor();
  await finishAlert(3);
  await nextFrames();
  assert.equal(await speech.getByText(prompt.text, { exact: true }).count(), 0, "um alerta antigo não retoma uma pergunta substituída");

  await question("alert-recovery");
  await expectWaiting(5);
  await finishAlert(4);
  await speech.getByText(prompt.text, { exact: true }).waitFor();
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready();
  await speech.getByText(prompt.text, { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__alertCalls.length), 0, "recuperar a fala atual não repete o som histórico");
  assert.deepEqual(errors, []);
  console.log("audience-warmup-alert-browser-test: ok (cursor → pulso único → pergunta; APIs, SSE e áudio simulados)");
} finally {
  await browser.close();
}
