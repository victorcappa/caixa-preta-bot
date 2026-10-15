import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createInitialSceneZeroState } from "../lib/scene-zero/state.js";
import { SCENE_ZERO_HANGMAN_INSTRUCTION } from "../data/scene-zero-hangman-words.js";

// All API traffic is intercepted: this regression must never reset a running show.
const baseUrl = process.env.CAIXA_PRETA_URL || "http://localhost:3000";
const sceneZero = createInitialSceneZeroState();
sceneZero.stage = "suitcases";
sceneZero.unlock = { ...sceneZero.unlock, status: "UNLOCKED", progress: 100, bootComplete: true };
sceneZero.suitcaseGame = {
  ...sceneZero.suitcaseGame,
  currentSuitcase: 3, openedSuitcases: [2, 3], status: "active", cuePhase: "open",
  suitcaseSelectedAt: new Date().toISOString(), suitcaseSelectionSequence: 4
};
const previousMessage = { id: "previous", role: "assistant", source: "scene-zero-suitcase-choice", content: "Próxima mala." };
let state = {
  revision: 1, sceneZero, conversation: [previousMessage], publicMessage: null,
  audienceWarmup: { manualMode: true, phase: "complete" },
  performance: { activities: [], events: [] }, projection: { windows: [] }
};
const actions = [];
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  context.setDefaultTimeout(15000);
  await context.addInitScript(() => {
    window.__suitcaseTestSources = [];
    window.EventSource = class {
      constructor() { window.__suitcaseTestSources.push(this); }
      close() {}
    };
  });
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() !== "GET") {
      if (pathname === "/api/scene-zero") actions.push(request.postDataJSON().action);
      await route.fulfill({ json: { sceneZero: state.sceneZero, state, message: "SIMULAÇÃO" } });
    } else {
      await route.fulfill({ json: pathname === "/api/state" ? state : {} });
    }
  });
  const projection = await context.newPage();
  const errors = [];
  projection.on("pageerror", (error) => errors.push(error.message));
  await projection.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const cue = projection.getByLabel("Mala indicada: 3", { exact: true });
  await cue.waitFor();
  assert.match(await cue.textContent(), /ABRA A MALA/);
  assert.equal(await projection.getByText(previousMessage.content, { exact: true }).count(), 0,
    "reabrir a projeção não pode ressuscitar a fala anterior durante a abertura");

  const instruction = { id: "hangman-instruction", role: "assistant", source: "scene-zero-hangman-instruction", content: SCENE_ZERO_HANGMAN_INSTRUCTION };
  state = { ...state, revision: 2, publicMessage: instruction, conversation: [...state.conversation, instruction] };
  await projection.evaluate((nextState) => {
    for (const source of window.__suitcaseTestSources) source.onmessage?.({ data: JSON.stringify({ event: { type: "message" }, state: nextState }) });
  }, state);
  await cue.waitFor({ state: "hidden" });
  const speech = projection.getByRole("main", { name: "Fala atual da Caixa Preta" });
  await projection.waitForFunction(() => document.querySelector('main[aria-label="Fala atual da Caixa Preta"]')?.textContent.includes("ESCOLHA UMA LETRA"));
  assert.equal(await speech.isVisible(), true);
  await projection.screenshot({ path: "/private/tmp/caixa-preta-forca-fala-visivel.png" });

  state = {
    ...state, revision: 3,
    sceneZero: {
      ...state.sceneZero,
      suitcaseGame: {
        ...state.sceneZero.suitcaseGame, currentSuitcase: 2, cuePhase: "complete",
        choice: { targetSuitcase: 3, status: "challenge_instruction", messageId: instruction.id },
        hangman: { ...state.sceneZero.suitcaseGame.hangman, status: "ready", theme: "aviação", themeDraw: { status: "selected" } }
      }
    }
  };
  await projection.evaluate((nextState) => {
    for (const source of window.__suitcaseTestSources) source.onmessage?.({ data: JSON.stringify({ event: { type: "snapshot" }, state: nextState }) });
  }, state);
  await projection.getByLabel("Sorteio do tema da Forca", { exact: true }).waitFor({ state: "hidden" });
  assert.equal(await speech.isVisible(), true, "o tema selecionado não pode encobrir a instrução da forca");

  state.sceneZero = {
    ...state.sceneZero,
    suitcaseGame: {
      ...state.sceneZero.suitcaseGame,
      currentSuitcase: 1, openedSuitcases: [2, 1], cuePhase: "complete",
      choice: { status: "ready", targetSuitcase: 1, messageId: "stale-draw" },
      contentInstruction: { kind: "last-suitcase", status: "complete", selectionSequence: 4 }
    }
  };
  const controller = await context.newPage();
  controller.on("pageerror", (error) => errors.push(error.message));
  await controller.goto(`${baseUrl}/cena-0-controller`, { waitUntil: "domcontentloaded" });
  const finish = controller.getByRole("button", { name: "SEGUIR → COMPLETAR DESBLOQUEIO", exact: true });
  await finish.waitFor();
  assert.equal(await finish.isEnabled(), true);
  await controller.locator("body").click({ position: { x: 10, y: 10 } });
  await Promise.all([
    controller.waitForResponse((response) => response.url().endsWith("/api/scene-zero")
      && response.request().postDataJSON()?.action === "suitcase-finish"),
    controller.keyboard.press("ArrowRight")
  ]);
  assert.equal(actions.at(-1), "suitcase-finish");
  assert.deepEqual(errors, []);
  console.log("scene-zero-suitcase-regression-browser-test: ok (API simulada, apresentação preservada)");
} finally {
  await browser.close();
}
