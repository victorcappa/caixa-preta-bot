import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { projectionScreens } from "../lib/projectionScreens.js";
import { controllerSurfaces } from "../lib/controllerSurfaces.js";
import { getSceneZeroHangmanWord } from "../data/scene-zero-hangman-words.js";

const base = process.env.CAIXA_PRETA_URL || "http://localhost:3000";
const output = process.env.CAIXA_PRETA_AUDIT_OUTPUT || "artifacts/bot-audit-2026-10-14";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const publicContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const privateContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const projection = await publicContext.newPage();
const operator = await privateContext.newPage();
const evidence = { microphone: "synthetic Web Audio stream", steps: [], routes: [], errors: [], networkErrors: [], assets: [] };
for (const page of [projection, operator]) {
  page.on("pageerror", (error) => evidence.errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) evidence.networkErrors.push({ status: response.status(), path: new URL(response.url()).pathname });
  });
}
const request = privateContext.request;
const state = async () => (await request.get(`${base}/api/state`)).json();
async function post(route, body, expected = true) {
  const response = await request.post(`${base}${route}`, { data: body });
  const data = await response.json();
  assert.equal(response.ok(), expected, `${route} ${body.action || body.command}: ${data.error}`);
  evidence.steps.push({ route, action: body.action || body.command, status: response.status(), at: new Date().toISOString() });
  return data;
}
const warmup = (action, payload = {}, expected = true) => post("/api/audience-warmup", { action, ...payload }, expected);
const scene = (action, payload = {}, expected = true) => post("/api/scene-zero", { action, ...payload }, expected);
async function wait(predicate, label, timeout = 45000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeout) {
    last = await state();
    if (predicate(last)) { console.log("CHECKPOINT", label); return last; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label}: ${JSON.stringify({ unlock: last?.sceneZero.unlock.status, phase: last?.audienceWarmup.phase,
    participant: last?.sceneZero.participantSelection?.status, suitcase: last?.sceneZero.suitcaseGame?.currentSuitcase,
    choice: last?.sceneZero.suitcaseGame?.choice?.status, cue: last?.sceneZero.suitcaseGame?.cuePhase })}`);
}
try {
  await post("/api/operator", { command: "/reset" });
  await privateContext.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const destination = context.createMediaStreamDestination();
      gain.gain.value = 0;
      oscillator.connect(gain).connect(destination);
      oscillator.start();
      window.__auditMicrophone = { context, gain };
      return destination.stream;
    };
  });
  await projection.goto(`${base}/?projectionWindow=full-show-audit`, { waitUntil: "domcontentloaded" });
  await operator.goto(`${base}/cena-0-controller`, { waitUntil: "domcontentloaded" });
  await operator.getByRole("button", { name: "BOOT", exact: true }).click();
  await warmup("unlock-pause-boot");
  let current = await state();
  while (current.sceneZero.unlock.status === "BOOTING") {
    await warmup("unlock-advance-boot");
    current = await state();
  }
  assert.equal(current.sceneZero.unlock.status, "BOOT_FAILED");
  await operator.getByRole("button", { name: "ENCERRAR BIOS", exact: true }).click();
  await wait((s) => s.sceneZero.unlock.soundCheck?.phase === "listening", "sound listening");
  await operator.evaluate(async () => {
    await window.__auditMicrophone.context.resume();
    await window.__caixaPretaControllerMicrophone?.context.resume();
    window.__auditMicrophone.gain.gain.value = 0.25;
  });
  await wait((s) => s.sceneZero.unlock.soundCheck?.completionSource === "microphone", "synthetic microphone confirmed");
  await wait((s) => s.audienceWarmup.startChoice?.status === "awaiting", "authored agreements and START choice");
  await warmup("agreements-start-choice", { choiceId: "start" });
  await wait((s) => s.audienceWarmup.previewPromptId?.startsWith("provocative-"), "required action and first question", 60000);
  for (const kind of ["many", "few"]) {
    const before = (await state()).audienceWarmup.previewPromptId;
    await warmup("record-response", { kind });
    await warmup("surprise");
    await wait((s) => s.audienceWarmup.reaction?.kind === kind, `${kind} reaction`);
    await wait((s) => s.audienceWarmup.previewPromptId !== before, "next question after reaction");
  }
  await warmup("questions-complete");
  await wait((s) => s.audienceWarmup.minigame.status === "ready_for_draw", "mini game briefing");
  await warmup("minigame-draw");
  current = await wait((s) => s.audienceWarmup.minigame.status === "ready", "selected mini game rules");
  evidence.minigame = current.audienceWarmup.minigame.selectedId;
  await warmup("minigame-start");
  if (evidence.minigame === "tapao") {
    await wait((s) => s.audienceWarmup.minigame.status === "ready_round_two", "Tapao first round and exchange");
    await warmup("minigame-start");
  }
  await wait((s) => s.audienceWarmup.phase === "complete", "warmup completed on real timer");
  await scene("set-stage", { stage: "participant" });
  await wait((s) => s.sceneZero.participantSelection.status === "complete", "participant invitation, countdown, name and center call");
  await scene("set-stage", { stage: "suitcases" });
  await wait((s) => s.sceneZero.suitcaseGame.currentSuitcase === 2 && s.sceneZero.suitcaseGame.contentInstruction?.status === "complete", "first draw, open and key instructions");
  await scene("gincana-timer-start");
  await wait((s) => s.sceneZero.suitcaseGame.gincana.timer.status === "running", "key timer running");
  await scene("gincana-complete");
  await projection.getByText("CHAVE ENCONTRADA.", { exact: true }).waitFor();
  await scene("suitcase-next");
  current = await wait((s) => s.sceneZero.suitcaseGame.hangman.status === "active", "pre-draw hangman theme and instructions");
  assert.deepEqual(current.sceneZero.suitcaseGame.openedSuitcases, [2]);
  await scene("hangman-error");
  const answer = getSceneZeroHangmanWord(current.sceneZero.suitcaseGame.hangman.wordId);
  assert(answer, "selected authored hangman word must exist");
  await scene("hangman-guess", { guess: answer.text });
  await wait((s) => s.sceneZero.suitcaseGame.currentSuitcase === 3 && !["drawing", "selected", "open"].includes(s.sceneZero.suitcaseGame.cuePhase), "second suitcase released only after win");
  await scene("suitcase-next");
  await projection.getByText("Abra a segunda mala e pegue o disco.", { exact: true }).waitFor();
  current = await wait((s) => s.sceneZero.suitcaseGame.currentSuitcase === 1 && s.sceneZero.suitcaseGame.contentInstruction?.status === "complete", "last suitcase and turntable instruction");
  assert.deepEqual(current.sceneZero.suitcaseGame.openedSuitcases, [2, 3, 1]);
  assert.notEqual(current.sceneZero.unlock.progress, 100);
  await scene("suitcase-finish");
  await wait((s) => s.sceneZero.unlock.progress === 100, "tutorial complete");
  await wait((s) => Object.values(s.displayBlackout.targets).every(Boolean), "final BIOS, glitch and blackout");
  await projection.screenshot({ path: path.join(output, "full-show-scene-zero-end.png") });
  evidence.sceneZeroComplete = true;
  await post("/api/operator", { command: "/stopall" });
  await post("/api/operator", { command: "/blackout all off" });

  // Subsequent scenes are independently operated surfaces, not an automatic script.
  for (const screen of projectionScreens) {
    if (screen.id === "baralho-morbido") continue;
    const response = await projection.goto(`${base}${screen.path}`, { waitUntil: "domcontentloaded" });
    await projection.waitForTimeout(150);
    const visiblePrivate = await projection.getByRole("textbox", { name: /anotações|instrução avulsa/i }).count();
    assert.equal(visiblePrivate, 0);
    evidence.routes.push({ path: screen.path, httpStatus: response.status(), privateFields: visiblePrivate });
    assert.equal(response.ok(), true);
  }
  for (const surface of controllerSurfaces) {
    if (surface.id === "baralho-morbido") continue;
    const response = await operator.goto(`${base}${surface.path}`, { waitUntil: "domcontentloaded" });
    evidence.routes.push({ path: surface.path, httpStatus: response.status() });
    assert.equal(response.ok(), true);
  }
  const cueStore = JSON.parse(await fs.readFile("data/controller-cues.json", "utf8"));
  const paths = new Set(Object.values(cueStore.controllers).flatMap((config) => config.cues.map((cue) => cue.assetPath).filter(Boolean)));
  for (const file of paths) {
    if (/\.(?:mp4|mov|m4v|webm)$/i.test(file)) continue;
    const response = await request.get(`${base}/api/game-assets?file=${encodeURIComponent(file)}`, { headers: { Range: "bytes=0-1023" } });
    evidence.assets.push({ file, status: response.status(), bytes: (await response.body()).length });
    assert([200, 206].includes(response.status()), file);
  }
  await post("/api/operator", { command: "/stopall" });
  assert.deepEqual(evidence.errors, []);
  assert.deepEqual(evidence.networkErrors, []);
  evidence.status = "PASS";
  console.log("Full Scene Zero flow and scoped surfaces passed; Baralho/videos excluded; physical theater acceptance remains separate");
} catch (error) {
  evidence.status = "FAIL";
  evidence.failure = error.message;
  await projection.screenshot({ path: path.join(output, "full-show-failure.png") }).catch(() => {});
  throw error;
} finally {
  await fs.writeFile(path.join(output, "full-show.json"), JSON.stringify(evidence, null, 2));
  await post("/api/operator", { command: "/stopall" }).catch(() => {});
  await browser.close();
}
