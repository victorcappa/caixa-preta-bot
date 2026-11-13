import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createInitialSceneZeroState } from "../lib/scene-zero/state.js";
import { ROBOT_SOUND_DEFAULTS } from "../lib/robot-sound/state.js";

// Every API request and the shared SSE worker are simulated. Never reset a live show.
const baseUrl = process.env.CAIXA_PRETA_URL || "http://localhost:3000";
const sceneZero = createInitialSceneZeroState();
sceneZero.stage = "suitcases";
sceneZero.unlock = { ...sceneZero.unlock, status: "UNLOCKED", progress: 100, bootComplete: true };
sceneZero.suitcaseGame = {
  ...sceneZero.suitcaseGame,
  status: "active", currentSuitcase: 2, openedSuitcases: [2],
  suitcaseSelectionSequence: 1, cuePhase: "complete"
};
let state = {
  revision: 1, sceneZero, publicMessage: null, conversation: [],
  robotSound: { ...ROBOT_SOUND_DEFAULTS, enabled: false, typingIntervalMs: 1000 / 60 },
  audienceWarmup: { manualMode: true, phase: "complete" },
  performance: { activities: [], events: [] }, projection: { windows: [] }
};
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  context.setDefaultTimeout(15000);
  await context.addInitScript(() => {
    window.__suitcaseSoundWorkers = [];
    window.SharedWorker = class {
      constructor() {
        this.port = { postMessage() {}, close() {} };
        window.__suitcaseSoundWorkers.push(this);
      }
    };
  });
  await context.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    await route.fulfill({ json: pathname === "/api/state"
      ? state
      : { sceneZero: state.sceneZero, state, message: "SIMULAÇÃO" } });
  });
  const projection = await context.newPage();
  const errors = [];
  projection.on("pageerror", (error) => errors.push(error.message));
  await projection.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await projection.waitForFunction(() => window.__caixaPretaRobotSoundEngine
    && window.__suitcaseSoundWorkers.some((worker) => worker.port.onmessage));
  await projection.getByLabel("Cursor da Caixa Preta", { exact: true }).waitFor();
  await projection.evaluate(() => {
    const engine = window.__caixaPretaRobotSoundEngine;
    window.__suitcaseSoundCounts = { success: 0, error: 0 };
    window.__suitcaseTypingCompletions = 0;
    for (const effect of ["success", "error"]) {
      const original = engine[effect].bind(engine);
      engine[effect] = (...args) => {
        window.__suitcaseSoundCounts[effect] += 1;
        return original(...args);
      };
    }
    const complete = engine.complete.bind(engine);
    engine.complete = (...args) => {
      window.__suitcaseTypingCompletions += 1;
      return complete(...args);
    };
  });

  async function publish(change = () => {}, eventType = "snapshot") {
    change(state.sceneZero.suitcaseGame);
    state = { ...state, revision: state.revision + 1 };
    await projection.evaluate(({ nextState, type }) => {
      for (const worker of window.__suitcaseSoundWorkers) {
        worker.port.onmessage?.({ data: { type: "payload", payload: { event: { type }, state: nextState } } });
      }
    }, { nextState: state, type: eventType });
  }

  async function expectCounts(success, error, explanation) {
    await projection.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.deepEqual(await projection.evaluate(() => window.__suitcaseSoundCounts), { success, error }, explanation);
  }

  async function resultMessage(source, content, change, success, error) {
    const completedBefore = await projection.evaluate(() => window.__suitcaseTypingCompletions);
    const message = { id: `result-${state.revision}`, role: "assistant", source, content };
    state = { ...state, publicMessage: message, conversation: [...state.conversation, message] };
    await publish(change, "message");
    await projection.waitForFunction((expected) => window.__suitcaseSoundCounts.success === expected.success
      && window.__suitcaseSoundCounts.error === expected.error, { success, error });
    assert.equal(await projection.evaluate(() => window.__suitcaseTypingCompletions), completedBefore,
      "o resultado deve soar antes de a fala terminar de digitar");
    await projection.waitForFunction(({ text, completed }) => window.__suitcaseTypingCompletions > completed
      && document.querySelector('main[aria-label="Fala atual da Caixa Preta"]')?.textContent.includes(text),
    { text: content, completed: completedBefore });
    await expectCounts(success, error, "o fim da digitação não deve duplicar o som do resultado");
    await publish();
    await expectCounts(success, error, "repetir o mesmo snapshot não deve repetir o resultado");
  }

  const timestamp = (seconds) => new Date(Date.UTC(2026, 10, 12, 12, 0, seconds)).toISOString();
  await publish((game) => {
    game.gincana.timer = { ...game.gincana.timer, status: "running", startedAt: timestamp(0), sequence: 1 };
  });
  await expectCounts(0, 0, "um desafio ativo não tem resultado");
  await resultMessage("scene-zero-gincana-retry:failure", "Falhou. Vamos tentar mais uma vez.", (game) => {
    game.gincana.result = "failed";
    game.gincana.observation = "resultado registrado pelo operador";
    game.gincana.timer = { ...game.gincana.timer, status: "failed", completedAt: timestamp(1), sequence: 2 };
    game.gincana.retry = { ...game.gincana.retry, status: "announcing", count: 1, messageId: state.publicMessage.id };
  }, 0, 1);
  await publish((game) => { game.gincana.retry.status = "ready"; });
  await expectCounts(0, 1, "aguardar a repetição não é outra derrota");
  await publish((game) => {
    game.gincana.result = null;
    game.gincana.timer = { ...game.gincana.timer, status: "running", completedAt: null, startedAt: timestamp(2), sequence: 3 };
  });
  await resultMessage("scene-zero-gincana-retry:failure", "O tempo acabou. Vamos tentar novamente.", (game) => {
    game.gincana.result = "failed";
    game.gincana.observation = "tempo esgotado";
    game.gincana.timer = { ...game.gincana.timer, status: "failed", completedAt: timestamp(3), sequence: 4 };
    game.gincana.retry = { ...game.gincana.retry, status: "announcing", count: 2, messageId: state.publicMessage.id };
  }, 0, 2);
  await publish((game) => {
    game.gincana.result = null;
    game.gincana.timer = { ...game.gincana.timer, status: "running", completedAt: null, startedAt: timestamp(4), sequence: 5 };
  });
  await resultMessage("scene-zero-gincana-result:success", "CHAVE ENCONTRADA. DESAFIO CONCLUÍDO.", (game) => {
    game.gincana.result = "completed";
    game.gincana.timer = { ...game.gincana.timer, status: "completed", completedAt: timestamp(5), sequence: 6 };
  }, 1, 2);

  await publish((game) => {
    game.choice = { ...game.choice, targetSuitcase: 1, status: "challenge" };
    game.hangman = { ...game.hangman, status: "active", wordId: "hangman-03", sequence: 1 };
  });
  await expectCounts(1, 2, "a forca pré-sorteio não deve repetir o resultado das bexigas");
  await resultMessage("scene-zero-hangman-retry:failure", "A forca venceu. Mais uma tentativa.", (game) => {
    game.hangman = {
      ...game.hangman, status: "retry_wait", sequence: 2,
      retry: { ...game.hangman.retry, status: "announcing", count: 1, messageId: null }
    };
  }, 1, 3);
  await publish((game) => { game.hangman.retry.messageId = state.publicMessage.id; });
  await expectCounts(1, 3, "atribuir o ID da fala à mesma derrota não deve repetir o som");
  await publish((game) => { game.hangman.retry.status = "ready"; });
  await expectCounts(1, 3, "a derrota da forca não se repete ao aguardar o operador");
  await publish((game) => {
    game.hangman = { ...game.hangman, status: "active", sequence: 3, retry: { ...game.hangman.retry, status: "running" } };
  });
  await resultMessage("scene-zero-hangman-result:success", "REGISTRO RECUPERADO. A PALAVRA ERA ALTITUDE.", (game) => {
    game.hangman = {
      ...game.hangman, status: "won", sequence: 4,
      timer: { ...game.hangman.timer, status: "complete", completedAt: timestamp(6) }
    };
  }, 2, 3);
  await publish((game) => {
    game.currentSuitcase = 1;
    game.suitcaseSelectionSequence = 2;
    game.choice = { ...game.choice, status: "idle", targetSuitcase: null };
  });
  await publish();
  await expectCounts(2, 3, "abrir a mala liberada pela forca não deve repetir a vitória já ouvida");

  await publish((game) => {
    game.currentSuitcase = 3;
    game.suitcaseSelectionSequence = 3;
    game.choice = { ...game.choice, status: "idle", targetSuitcase: null };
    game.status = "finished";
    game.endedAt = timestamp(7);
  });
  await projection.waitForFunction(() => window.__suitcaseSoundCounts.success === 3);
  await publish();
  await expectCounts(3, 3, "a última mala toca uma vitória ao concluir e não a repete");
  state.sceneZero.stage = "participant";
  await publish((game) => { game.endedAt = timestamp(8); });
  await expectCounts(3, 3, "resultados antigos não devem soar fora do jogo das malas");
  state.sceneZero = createInitialSceneZeroState();
  state = { ...state, conversation: [], publicMessage: null };
  await publish(() => {}, "reset");
  await expectCounts(3, 3, "reiniciar não deve produzir vitória nem derrota");
  assert.deepEqual(errors, []);
  console.log("scene-zero-suitcase-sounds-browser-test: ok (SSE e APIs simulados; disparos de áudio, sem validação física)");
} finally {
  await browser.close();
}
