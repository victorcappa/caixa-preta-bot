import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createInitialAudienceWarmupState } from "../lib/audienceWarmup.js";
import { createInitialSceneZeroState } from "../lib/scene-zero/state.js";
import { normalizeControllerSettings } from "../lib/controllerSettingsSchema.js";

// Every API request and the realtime transport are mocked; never writes to a show.
const baseUrl = process.env.CAIXA_PRETA_URL || "http://localhost:3000";
function fixture() {
  const sceneZero = createInitialSceneZeroState();
  sceneZero.unlock = { ...sceneZero.unlock, status: "UNLOCKED", bootComplete: true, progress: 100 };
  return {
    revision: 1, sceneZero,
    audienceWarmup: { ...createInitialAudienceWarmupState(), manualMode: true, phase: "questions" },
    performance: { activities: [], events: [] }, projection: { windows: {} }
  };
}
const runningTimer = () => ({ status: "running", durationSeconds: 20, remainingSeconds: 20, endsAt: new Date(Date.now() + 20000).toISOString() });
let state = fixture();
let revision = 1;
const actions = [];
const errors = [];
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: "block" });
  context.setDefaultTimeout(15000);
  await context.addInitScript(() => {
    window.__shortcutRealtimePorts = [];
    window.SharedWorker = class {
      constructor() {
        this.port = { postMessage() {}, start() {}, close() {} };
        window.__shortcutRealtimePorts.push(this.port);
      }
    };
    window.EventSource = class { close() {} };
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Test microphone disabled", "NotAllowedError"); };
  });
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET") {
      if (["/api/scene-zero", "/api/audience-warmup"].includes(url.pathname)) {
        actions.push({ path: url.pathname, ...request.postDataJSON() });
      }
      await route.fulfill({ json: { sceneZero: state.sceneZero, audienceWarmup: state.audienceWarmup, message: `TEST ACTION ${actions.length}` } });
    } else if (url.pathname === "/api/state") {
      await route.fulfill({ json: state });
    } else if (url.pathname === "/api/controller-settings") {
      await route.fulfill({ json: { settings: normalizeControllerSettings(url.searchParams.get("scope")) } });
    } else {
      await route.fulfill({ json: {} });
    }
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/cena-0-controller`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Instrução avulsa para o bot", { exact: true }).waitFor();
  await page.waitForFunction(() => window.__shortcutRealtimePorts.some((port) => typeof port.onmessage === "function"));

  async function publish(next, branch = null) {
    state = { ...next, revision: ++revision };
    await page.evaluate(async ({ nextState, changedBranch }) => {
      const previous = window.__shortcutState;
      // Preserve unrelated object references to catch stale effect dependencies.
      const next = changedBranch && previous
        ? { ...previous, revision: nextState.revision, sceneZero: { ...previous.sceneZero, [changedBranch]: nextState.sceneZero[changedBranch] } }
        : nextState;
      window.__shortcutState = next;
      for (const port of window.__shortcutRealtimePorts) {
        port.onmessage?.({ data: { type: "payload", payload: { event: { type: "snapshot" }, state: next } } });
      }
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, { nextState: state, changedBranch: branch });
    await page.locator("body").click({ position: { x: 10, y: 10 } });
  }
  async function ignored(key, label) {
    const before = actions.length;
    await page.keyboard.press(key);
    await page.waitForTimeout(100);
    assert.equal(actions.length, before, label);
  }
  async function sent(key, action, path = "/api/audience-warmup") {
    const before = actions.length;
    await page.keyboard.press(key);
    await page.getByText(`TEST ACTION ${before + 1}`, { exact: true }).waitFor();
    assert.equal(actions.length, before + 1, `${key} must send exactly one action`);
    assert.equal(actions.at(-1).action, action);
    assert.equal(actions.at(-1).path, path);
  }

  const warmupTimer = fixture();
  warmupTimer.audienceWarmup.actionTimer = runningTimer();
  await publish(warmupTimer);
  await ignored("ArrowRight", "plain right must preserve a running warmup timer");
  await sent("Shift+ArrowRight", "primary-next");
  await publish(fixture());
  await sent("ArrowRight", "primary-next");
  await sent("Shift+ArrowRight", "return-to-sound-check", "/api/scene-zero");
  const paused = fixture();
  paused.audienceWarmup.phase = "minigame";
  paused.audienceWarmup.minigame = {
    ...paused.audienceWarmup.minigame, status: "paused", selectedId: "tapao",
    timer: { ...runningTimer(), status: "paused", endsAt: null }
  };
  await publish(paused);
  await ignored("ArrowRight", "plain right must preserve a paused minigame");
  await sent("Shift+ArrowRight", "minigame-resume");
  await publish(warmupTimer);
  await page.getByLabel("Instrução avulsa para o bot", { exact: true }).focus();
  await ignored("Shift+ArrowRight", "typing fields must retain their arrow behavior");
  await page.locator("body").click({ position: { x: 10, y: 10 } });
  for (const key of ["Control+Shift+ArrowRight", "Meta+Shift+ArrowRight", "Alt+Shift+ArrowRight"]) {
    await ignored(key, `${key} must not advance`);
  }
  const beforeRepeat = actions.length;
  await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, repeat: true, bubbles: true })));
  await page.waitForTimeout(100);
  assert.equal(actions.length, beforeRepeat, "repeated keydown must not advance");

  for (const name of ["gincana", "hangman"]) {
    const challenge = fixture();
    challenge.sceneZero.stage = "suitcases";
    const game = challenge.sceneZero.suitcaseGame;
    game.currentSuitcase = name === "gincana" ? 2 : 1;
    game.openedSuitcases = [game.currentSuitcase];
    game.status = "active";
    game.cuePhase = "complete";
    game[name].timer = runningTimer();
    if (name === "hangman") game.hangman.status = "active";
    else game.gincana.currentTask = { id: "test-task", instruction: "Desafio em andamento." };
    await publish(challenge);
    await ignored("ArrowRight", `plain right must preserve the running ${name} challenge`);
    await ignored("Shift+ArrowRight", `Shift must preserve ${name} guards without rewinding the stage`);
  }

  for (const branch of ["timer", "collection"]) {
    const idle = fixture();
    await publish(idle);
    const timed = structuredClone(idle);
    if (branch === "timer") timed.sceneZero.timer = runningTimer();
    else timed.sceneZero.collection.activeCountdown = runningTimer();
    await publish(timed, branch);
    await ignored("ArrowRight", `${branch} timer arriving over realtime must immediately require Shift`);
    await publish(idle, branch);
    await sent("ArrowRight", "primary-next");
    await publish(timed, branch);
    await sent("Shift+ArrowRight", "primary-next");
  }

  const timerBranches = [
    ["actionTimer", (next, timer) => { next.audienceWarmup.actionTimer = timer; }],
    ["minigame", (next, timer) => { next.audienceWarmup.minigame.timer = timer; }],
    ["scene timer", (next, timer) => { next.sceneZero.timer = timer; }],
    ["collection", (next, timer) => { next.sceneZero.collection.activeCountdown = timer; }],
    ["gincana", (next, timer) => { next.sceneZero.suitcaseGame.gincana.timer = timer; }],
    ["hangman", (next, timer) => { next.sceneZero.suitcaseGame.hangman.timer = timer; }]
  ];
  for (const [name, setTimer] of timerBranches) {
    // Keep the continuation in questions: an expired timer must remove only the
    // Shift requirement, without bypassing the suitcases' challenge guards.
    const expired = fixture();
    setTimer(expired, { ...runningTimer(), endsAt: new Date(Date.now() - 1000).toISOString() });
    await publish(expired);
    await sent("ArrowRight", "primary-next");

    const pausedZero = fixture();
    setTimer(pausedZero, { ...runningTimer(), status: "paused", remainingSeconds: 0, endsAt: null });
    await publish(pausedZero);
    await sent("ArrowRight", "primary-next");

    const ticking = fixture();
    const timer = runningTimer();
    setTimer(ticking, timer);
    await publish(ticking);
    await ignored("ArrowRight", `${name} must require Shift while time remains`);
    await page.evaluate((now) => {
      window.__shortcutOriginalDateNow = Date.now;
      Date.now = () => now;
    }, Date.parse(timer.endsAt) + 1);
    try {
      // No new realtime snapshot: the key handler must read the current clock.
      await sent("ArrowRight", "primary-next");
    } finally {
      await page.evaluate(() => {
        Date.now = window.__shortcutOriginalDateNow;
        delete window.__shortcutOriginalDateNow;
      });
    }
  }

  const participantTimer = fixture();
  participantTimer.sceneZero.participantSelection.status = "countdown";
  participantTimer.sceneZero.participantSelection.countdownEndsAt = runningTimer().endsAt;
  await publish(participantTimer);
  await ignored("ArrowRight", "participant countdown must require Shift");
  await sent("Shift+ArrowRight", "primary-next");
  // Re-establish the published references after the action response so that
  // only countdownEndsAt changes in the next realtime update.
  await publish(participantTimer);
  const expiredParticipantTimer = structuredClone(participantTimer);
  expiredParticipantTimer.sceneZero.participantSelection.countdownEndsAt = new Date(Date.now() - 1000).toISOString();
  await publish(expiredParticipantTimer, "participantSelection");
  await sent("ArrowRight", "primary-next");

  await publish(participantTimer, "participantSelection");
  await ignored("ArrowRight", "updating only the participant deadline must restore the Shift requirement");
  await page.evaluate((now) => {
    window.__shortcutOriginalDateNow = Date.now;
    Date.now = () => now;
  }, Date.parse(participantTimer.sceneZero.participantSelection.countdownEndsAt) + 1);
  try {
    await sent("ArrowRight", "primary-next");
  } finally {
    await page.evaluate(() => {
      Date.now = window.__shortcutOriginalDateNow;
      delete window.__shortcutOriginalDateNow;
    });
  }

  assert.deepEqual(errors, [], "controller must render all timer fixtures without browser errors");
  console.log("scene-zero-timer-shortcuts-browser-test: ok (mocked APIs and realtime; show preserved)");
} finally {
  await browser.close();
}
