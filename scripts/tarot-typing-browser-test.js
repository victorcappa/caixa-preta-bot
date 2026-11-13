import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { prepareOperatorAudit } from "./operator-public-audit-utils.js";

// Real control/API/SSE/typewriter in an isolated production server. The card is
// digital, the catalogue is a private copy, and model transport is intercepted.
// This does not use the active show, a physical camera, or a paid model call.
const root = process.cwd(), auditRoot = await prepareOperatorAudit();
assert.notEqual(path.resolve(auditRoot), path.resolve(root));
const assets = path.join(auditRoot, "assets");
if ((await fs.lstat(assets)).isSymbolicLink()) {
  await fs.unlink(assets); await fs.mkdir(assets);
  for (const entry of await fs.readdir(path.join(root, "assets"))) {
    if (entry === "tarot") await fs.cp(path.join(root, "assets", entry), path.join(assets, entry), { recursive: true });
    else await fs.symlink(path.join(root, "assets", entry), path.join(assets, entry));
  }
}
const text = "Abcdefghij. Klmnopqrst.\n\nUvwx.";
const catalogPath = path.join(assets, "tarot/catalog.json");
const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
catalog[0].contingency = text;
await fs.writeFile(catalogPath, JSON.stringify(catalog));
const base = "http://127.0.0.1:3330", output = await fs.mkdtemp("/private/tmp/tarot-typing-browser-");
const fixture = path.join(output, "model.json");
await fs.writeFile(fixture, JSON.stringify({ compact: true }));
await fs.writeFile(`${fixture}.calls.jsonl`, "");
let occupied = false;
try { await fetch(base, { signal: AbortSignal.timeout(500) }); occupied = true; } catch {}
assert(!occupied, "Audit port 3330 occupied; no process will be stopped");
const server = spawn(process.execPath, ["--import", fileURLToPath(new URL("./tarot-model-mock.js", import.meta.url)), "node_modules/next/dist/bin/next", "start", "--port", "3330", "--hostname", "127.0.0.1"], {
  cwd: auditRoot,
  env: { ...process.env, OPENAI_API_KEY: "audit-only", CAIXA_PRETA_TAROT_MOCK: fixture, CAIXA_PRETA_SHOW_RUNTIME_DIR: path.join(output, "runtime") },
  stdio: ["ignore", "pipe", "pipe"]
});
let log = "", browser, projection, controls, sessionId;
const errors = [], checks = [], measurements = {};
server.stdout.on("data", chunk => { log += chunk; }); server.stderr.on("data", chunk => { log += chunk; });
const state = async () => (await fetch(base + "/api/state")).json();
const privateState = async () => (await fetch(base + "/api/tarot")).json();
async function post(route, body) {
  const response = await fetch(base + route, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, ...body }) });
  const result = await response.json(); assert(response.ok && result.ok !== false, JSON.stringify(result)); return result;
}
const command = (action, data = {}) => post("/api/tarot", { action, ...data });
async function poll(check, label, timeout = 20000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 40)); }
  throw new Error("Timeout: " + label);
}
const speedLabel = "Velocidade da escrita (×)", sentenceLabel = "Pausa entre frases (s)", paragraphLabel = "Pausa entre parágrafos (s)";
async function keySetting(label, key, field, expected) {
  const slider = controls.getByRole("slider", { name: label, exact: true });
  await slider.press(key);
  await poll(async () => (await privateState()).tarot.config[field] === expected, label + " saved");
}
async function samples(id) { return projection.evaluate(id => window.__tarotTypingSamples.filter(sample => sample.id === id), id); }
async function startText() {
  await command("contingency");
  const response = (await privateState()).tarot.response;
  assert.equal(response.text, text);
  await poll(async () => (await samples(response.id)).some(sample => sample.text.length > 0), "first typed character");
  return response.id;
}
async function completed(id) {
  await poll(async () => { const response = (await privateState()).tarot.response; return response?.id === id && response.status === "complete"; }, "typing completion");
  const timeline = await samples(id);
  assert.equal(timeline.at(-1).text, text);
  for (let i = 1; i < timeline.length; i++) {
    assert(text.startsWith(timeline[i].text));
    assert(timeline[i].text.length >= timeline[i - 1].text.length, "settings/SSE must not restart the cursor");
  }
  return timeline;
}
function gap(timeline, length) {
  const before = timeline.find(sample => sample.text.length === length);
  const after = timeline.find(sample => sample.text.length > length);
  assert(before && after, `Missing browser samples at character ${length}`);
  return after.at - before.at;
}
try {
  await poll(async () => { try { return (await fetch(base + "/api/health?skipOptional=1")).ok; } catch { return false; } }, "isolated server", 30000);
  sessionId = (await privateState()).sessionId;
  const defaults = (await state()).tarot.presentation;
  assert.equal(defaults.revealSpeed, 1); assert.equal(defaults.sentencePauseMs, 500); assert.equal(defaults.paragraphPauseMs, 1200);
  await command("config", { config: { floorEnabled: false, intervalMs: 120000 } });
  await command("start"); await command("camera", { enabled: false });
  browser = await chromium.launch({ headless: true, args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Camera disabled for the pacing audit", "NotAllowedError"); };
    window.__tarotTypingSamples = [];
    addEventListener("DOMContentLoaded", () => {
      let last = "";
      new MutationObserver(() => {
        const main = document.querySelector("main[data-response-id]"), speech = main?.querySelector('[class*="speechText"]');
        if (!speech || !main.dataset.responseId) return;
        const text = speech.textContent.replace(/▌$/, ""), key = main.dataset.responseId + ":" + text;
        if (key !== last) { last = key; window.__tarotTypingSamples.push({ id: main.dataset.responseId, text, at: performance.now() }); }
      }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["data-response-id"] });
    });
  });
  projection = await context.newPage(); controls = await context.newPage();
  for (const page of [projection, controls]) page.on("pageerror", error => errors.push(error.message));
  await projection.goto(base + "/treinamento");
  await controls.goto(base + "/treinamento/controle");
  await controls.getByRole("slider", { name: speedLabel, exact: true }).waitFor();
  assert.equal(await controls.getByRole("slider", { name: sentenceLabel, exact: true }).inputValue(), "0.5");
  assert.equal(await controls.getByRole("slider", { name: paragraphLabel, exact: true }).inputValue(), "1.2");
  await keySetting(speedLabel, "End", "revealSpeed", 4);
  await keySetting(sentenceLabel, "ArrowRight", "sentencePauseMs", 600);
  await keySetting(paragraphLabel, "ArrowRight", "paragraphPauseMs", 1300);
  await keySetting(paragraphLabel, "ArrowRight", "paragraphPauseMs", 1400);
  await controls.reload(); await controls.getByRole("slider", { name: speedLabel, exact: true }).waitFor();
  assert.equal(await controls.getByRole("slider", { name: speedLabel, exact: true }).inputValue(), "4");
  assert.equal(await controls.getByRole("slider", { name: paragraphLabel, exact: true }).inputValue(), "1.4");
  await command("reset");
  const retained = (await privateState()).tarot.config;
  assert.equal(retained.revealSpeed, 4); assert.equal(retained.sentencePauseMs, 600); assert.equal(retained.paragraphPauseMs, 1400);
  checks.push("Tarot presentation controls expose positive defaults and persist private speed/sentence/paragraph tuning through reload and training reset");
  await command("start"); await command("camera", { enabled: false });
  await command("autonomy-start"); await command("next", { cardId: 0 }); await command("human");
  await poll(async () => Boolean((await privateState()).tarot.camera.owner), "projection owner lease");
  await post("/api/robot-sound", { settings: { typingIntervalMs: 200, typingPauseMs: 2000, messageGapMs: 10000 } });
  const started = Date.now(), firstId = await startText(), first = await completed(firstId);
  measurements.fastDurationMs = Date.now() - started;
  measurements.sentencePauseMs = gap(first, text.indexOf(".") + 1);
  measurements.paragraphPauseMs = gap(first, text.indexOf("\n"));
  measurements.blankLineGapMs = gap(first, text.indexOf("\n") + 1);
  measurements.paragraphStartGapMs = gap(first, text.indexOf("\n") + 2);
  assert(measurements.fastDurationMs < 5500, "Tarot must not inherit the global ten-second initial gap");
  assert(measurements.sentencePauseMs >= 550 && measurements.sentencePauseMs < 1100, JSON.stringify(measurements));
  assert(measurements.paragraphPauseMs >= 1300 && measurements.paragraphPauseMs < 1900, JSON.stringify(measurements));
  assert(measurements.blankLineGapMs < 250 && measurements.paragraphStartGapMs < 250, "One paragraph hold; no extra hold on both newline characters");
  checks.push("At 4×, real browser typing retains configured sentence and paragraph holds exactly once, independent of global speed/punctuation/message-gap settings");
  await keySetting(speedLabel, "Home", "revealSpeed", 0.25);
  await keySetting(sentenceLabel, "Home", "sentencePauseMs", 0);
  const secondId = await startText();
  await poll(async () => (await samples(secondId)).some(sample => sample.text.length >= 3), "slow response reaches third character");
  await keySetting(speedLabel, "End", "revealSpeed", 4);
  const second = await completed(secondId);
  measurements.slowCharacterMs = gap(second, 1);
  measurements.liveFastCharacterMs = gap(second, 8);
  assert(measurements.slowCharacterMs >= 190, JSON.stringify(measurements));
  assert(measurements.liveFastCharacterMs < 130, JSON.stringify(measurements));
  checks.push("Changing the Tarot speed during writing takes effect on subsequent characters while preserving the same response and monotonic cursor");
  assert.equal((await fs.readFile(`${fixture}.calls.jsonl`, "utf8")).trim().split("\n").filter(Boolean).length, 1, "Only the initial intercepted digital-card generation is used");
  assert.equal((await state()).publicMessage, null);
  assert.deepEqual(errors, []);
  await controls.screenshot({ path: path.join(output, "tarot-pacing-controls.png"), fullPage: true });
  const report = { ok: true, checks, measurements, liveModel: false, physicalCamera: false, physicalAudio: false, projector: false, auditRoot, output };
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await fs.writeFile(path.join(output, "server.log"), log);
  if (projection) await projection.screenshot({ path: path.join(output, "failure.png"), fullPage: true }).catch(() => {});
  throw new Error(`${error.message}\nEvidence: ${output}`, { cause: error });
} finally {
  await browser?.close(); server.kill("SIGTERM");
}
