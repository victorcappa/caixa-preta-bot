import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { prepareOperatorAudit } from "./operator-public-audit-utils.js";

// Isolated production source/runtime and intercepted provider transport. No
// active show, physical camera/microphone, or paid model request is involved.
const auditRoot = await prepareOperatorAudit();
assert.notEqual(path.resolve(auditRoot), process.cwd());
await fs.writeFile(path.join(auditRoot, "data/training-examples.json"), "[]");
const base = "http://127.0.0.1:3331", output = await fs.mkdtemp("/private/tmp/live-training-typing-");
const fixture = path.join(output, "provider.json");
await fs.writeFile(fixture, JSON.stringify({ chunks: ["Abc, def.\n\nGhi!"], delay: 10 }));
let occupied = false;
try { await fetch(base, { signal: AbortSignal.timeout(500) }); occupied = true; } catch {}
assert(!occupied, "Audit port 3331 occupied; no existing process will be stopped");
const server = spawn(process.execPath, ["--import", fileURLToPath(new URL("./operator-public-mock.js", import.meta.url)),
  "node_modules/next/dist/bin/next", "start", "--port", "3331", "--hostname", "127.0.0.1"], {
  cwd: auditRoot,
  env: { ...process.env, OPENAI_API_KEY: "audit-only", OPENAI_BASE_URL: "https://api.openai.com/v1",
    CAIXA_PRETA_SHOW_RUNTIME_DIR: path.join(output, "runtime"), CAIXA_PRETA_OPERATOR_MOCK: fixture },
  stdio: ["ignore", "pipe", "pipe"]
});
let log = "", browser, display, control, sessionId;
const checks = [], errors = [], measurements = {};
server.stdout.on("data", chunk => { log += chunk; }); server.stderr.on("data", chunk => { log += chunk; });
const state = async () => (await fetch(base + "/api/state")).json();
async function post(route, body) {
  const response = await fetch(base + route, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json(); assert(response.ok, JSON.stringify(result)); return result;
}
async function poll(check, label, timeout = 20000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (server.exitCode !== null) throw new Error(log.slice(-2500));
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error("Timeout: " + label);
}
const reply = (page, id) => page.locator(`[data-message-id="${id}"] p[data-typing]`);
const samples = id => display.evaluate(id => window.__liveTypingSamples.filter(sample => sample.id === id), id);
async function completed(id, text) {
  await poll(async () => await reply(display, id).textContent() === text && await reply(display, id).getAttribute("data-typing") === "false", "public typing completed");
  await poll(async () => await reply(control, id).textContent() === text, "private typing completed");
  const timeline = await samples(id);
  for (let index = 1; index < timeline.length; index++) {
    assert(text.startsWith(timeline[index].text));
    assert(timeline[index].text.length >= timeline[index - 1].text.length, "stream updates must not restart the cursor");
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
  await poll(async () => { try { return (await fetch(base + "/api/health?skipOptional=1")).ok; } catch { return false; } }, "isolated server ready", 30000);
  sessionId = (await state()).reliability.sessionId;
  await post("/api/robot-sound", { settings: { typingIntervalMs: 40, typingPauseMs: 0, messageGapMs: 0 } });
  browser = await chromium.launch({ headless: true, args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Media disabled for the pacing audit", "NotAllowedError"); };
    window.__liveTypingSamples = [];
    addEventListener("DOMContentLoaded", () => {
      const previous = new Map();
      new MutationObserver(() => {
        for (const article of document.querySelectorAll('[data-role="assistant"][data-message-id]')) {
          const paragraph = article.querySelector("p[data-typing]");
          if (!paragraph) continue;
          const text = paragraph.textContent.replace(/_$/, ""), id = article.dataset.messageId, typing = paragraph.dataset.typing;
          if (previous.get(id) === text + ":" + typing) continue;
          previous.set(id, text + ":" + typing);
          window.__liveTypingSamples.push({ id, text, typing, at: performance.now() });
        }
      }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["data-typing"] });
    });
  });
  display = await context.newPage(); control = await context.newPage();
  for (const page of [display, control]) page.on("pageerror", error => errors.push(error.message));
  await display.goto(base + "/treino-ao-vivo?projectionWindow=live-typing-test");
  await control.goto(base + "/treino-ao-vivo/controle");
  await control.getByRole("textbox", { name: "Mensagem", exact: true }).waitFor();
  const text = "Abc, def.\n\nGhi!", firstId = "bot-light-pacing";
  await post("/api/live-training", { action: "send", sessionId, text: "Teste isolado de ritmo.", requestId: "light-pacing" });
  const first = await completed(firstId, text);
  measurements.characterMs = gap(first, 1);
  measurements.punctuationMs = gap(first, 5);
  measurements.beforeBlankLineMs = gap(first, 9);
  measurements.betweenNewlinesMs = gap(first, 10);
  measurements.paragraphMs = gap(first, 11);
  assert(measurements.characterMs >= 25 && measurements.characterMs < 140, JSON.stringify(measurements));
  assert(measurements.punctuationMs >= 180 && measurements.punctuationMs < 420, JSON.stringify(measurements));
  assert(measurements.beforeBlankLineMs < 160 && measurements.betweenNewlinesMs < 160, "Period and newlines must not stack extra holds");
  assert(measurements.paragraphMs >= 580 && measurements.paragraphMs < 900, JSON.stringify(measurements));
  assert.equal((await state()).robotSound.typingPauseMs, 0);
  checks.push("Live training adds light punctuation and one paragraph hold at zero global pause while keeping the configured character speed in public/private views");

  await fs.writeFile(fixture, JSON.stringify({ chunks: ["A.", "\n", "\nB"], delay: 250 }));
  const secondId = "bot-split-boundary";
  const sending = post("/api/live-training", { action: "send", sessionId, text: "Teste isolado de chunks.", requestId: "split-boundary" });
  await poll(async () => (await samples(secondId)).some(sample => sample.text === "A."), "renderer catches first stream chunk");
  assert.notEqual((await state()).liveTraining.status, "idle");
  await sending;
  assert.equal(await reply(display, secondId).getAttribute("data-typing"), "true", "Buffered paragraph must continue typing after provider completion");
  const second = await completed(secondId, "A.\n\nB");
  measurements.splitParagraphMs = gap(second, 4);
  assert(measurements.splitParagraphMs >= 580 && measurements.splitParagraphMs < 900, JSON.stringify(measurements));
  checks.push("A period and blank line arriving in separate caught-up stream chunks retain one paragraph pause, with monotonic buffered typing after transport completion");

  await display.reload();
  await poll(async () => await reply(display, secondId).count() > 0, "completed history restored");
  assert.equal(await reply(display, secondId).textContent(), "A.\n\nB");
  const restored = await samples(secondId);
  assert(restored.length > 0);
  assert(restored.every(sample => sample.text === "A.\n\nB" && sample.typing === "false"), "Completed history must restore immediately without replay");
  assert.deepEqual(errors, []);
  checks.push("Completed history reloads immediately without replaying typewriter or pauses");
  await control.screenshot({ path: path.join(output, "live-training-pacing.png"), fullPage: true });
  const report = { ok: true, checks, measurements, liveModel: false, physicalCamera: false, physicalAudio: false, auditRoot, output };
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await fs.writeFile(path.join(output, "server.log"), log);
  await display?.screenshot({ path: path.join(output, "failure.png"), fullPage: true }).catch(() => {});
  throw new Error(`${error.message}\nEvidence: ${output}`, { cause: error });
} finally {
  await browser?.close(); server.kill("SIGTERM");
}
