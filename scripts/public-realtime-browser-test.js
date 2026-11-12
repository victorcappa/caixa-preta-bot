import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { prepareOperatorAudit } from "./operator-public-audit-utils.js";

// Own a disposable production server and runtime; never reset the active show.
const root = await prepareOperatorAudit();
const reservation = net.createServer();
await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const BASE_URL = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", `${port}`, "--hostname", "127.0.0.1"], {
  cwd: root, env: { ...process.env, OPENAI_API_KEY: "", CAIXA_PRETA_SHOW_RUNTIME_DIR: path.join(root, `realtime-runtime-${process.pid}`) },
  stdio: ["ignore", "pipe", "pipe"]
});
let serverLog = "";
server.stdout.on("data", chunk => { serverLog += chunk; });
server.stderr.on("data", chunk => { serverLog += chunk; });
let ready = false;
for (let attempt = 0; attempt < 100 && server.exitCode === null; attempt += 1) {
  try { ready = (await fetch(`${BASE_URL}/api/state?revision=1`, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
  if (ready) break;
  await new Promise(resolve => setTimeout(resolve, 100));
}
if (!ready) { server.kill("SIGTERM"); throw new Error(serverLog); }
const CONTROLLER_ID = "tea-for-two";

async function stopAll(request) {
  const response = await request.post(`${BASE_URL}/api/controller-cues/play`, {
    data: { controllerId: CONTROLLER_ID, action: "stop-all" }
  });
  assert.equal(response.ok(), true, "public cue state should reset");
}

async function revision(request) {
  const response = await request.get(`${BASE_URL}/api/state?revision=1`);
  assert.equal(response.ok(), true, "revision probe should succeed");
  const data = await response.json();
  assert.equal(Number.isFinite(data.revision), true, "revision probe should be numeric");
  return data.revision;
}

async function openPair(browser, { polling = false } = {}) {
  const context = await browser.newContext();
  if (polling) await context.addInitScript(() => {
    Object.defineProperty(window, "SharedWorker", { value: undefined });
  });

  const projection = await context.newPage();
  await projection.goto(`${BASE_URL}/tea-for-two`, { waitUntil: "domcontentloaded" });

  const controller = await context.newPage();
  await controller.goto(`${BASE_URL}/tea-for-two-controller`, { waitUntil: "domcontentloaded" });
  await controller.getByRole("button", { name: "Tocar Tea For Two" }).waitFor();

  return { context, controller, projection };
}

async function clickCueAction(controller, name, action) {
  const [response] = await Promise.all([
    controller.waitForResponse((candidate) => {
      if (!candidate.url().endsWith("/api/controller-cues/play") || candidate.request().method() !== "POST") {
        return false;
      }
      return candidate.request().postDataJSON()?.action === action;
    }),
    controller.getByRole("button", { name }).evaluate((button) => button.click())
  ]);
  assert.equal(response.ok(), true, `${name} request should succeed`);
  return response.json();
}

const browser = await chromium.launch({ headless: true });

try {
  const setupContext = await browser.newContext();
  await stopAll(setupContext.request);
  await setupContext.close();
} catch (error) {
  await browser.close();
  server.kill("SIGTERM");
  throw error;
}

try {
  const normal = await openPair(browser);
  await stopAll(normal.context.request);
  const beforeRevision = await revision(normal.context.request);
  const startedAt = Date.now();
  await clickCueAction(normal.controller, "Tocar Tea For Two", "play");
  await normal.projection.locator("audio").waitFor({ state: "attached", timeout: 1500 });
  assert(Date.now() - startedAt < 1500, "SSE update should reach the public page immediately");
  assert(await revision(normal.context.request) > beforeRevision, "controller action should advance the state revision");
  const normalStop = await clickCueAction(normal.controller, "SILÊNCIO / STOP ALL", "stop-all");
  assert.equal(normalStop.state.audioCues.some((cue) => cue.controllerId === CONTROLLER_ID), false);
  await normal.projection.locator("audio").waitFor({ state: "detached", timeout: 1500 });
  await normal.context.close();

  const fallback = await openPair(browser, { polling: true });
  await stopAll(fallback.context.request);
  await fallback.projection.locator("audio").waitFor({ state: "detached" });
  await clickCueAction(fallback.controller, "Tocar Tea For Two", "play");
  await fallback.projection.locator("audio").waitFor({ state: "attached", timeout: 2000 });
  const fallbackStop = await clickCueAction(fallback.controller, "SILÊNCIO / STOP ALL", "stop-all");
  assert.equal(fallbackStop.state.audioCues.some((cue) => cue.controllerId === CONTROLLER_ID), false);
  await fallback.projection.locator("audio").waitFor({ state: "detached", timeout: 2000 });
  await fallback.context.close();

  const offline = await openPair(browser, { polling: true });
  await stopAll(offline.context.request);
  await offline.projection.locator("audio").waitFor({ state: "detached" });
  await offline.context.setOffline(true);
  const onlineContext = await browser.newContext();
  const config = await onlineContext.request.get(`${BASE_URL}/api/controller-cues?id=${CONTROLLER_ID}`).then((response) => response.json());
  const started = await onlineContext.request.post(`${BASE_URL}/api/controller-cues/play`, {
    data: { controllerId: CONTROLLER_ID, action: "play", cue: config.config.cues[0] }
  });
  assert.equal(started.ok(), true);
  await offline.projection.waitForTimeout(500);
  assert.equal(await offline.projection.locator("audio").count(), 0, "offline projection must retain its last frame");
  await offline.context.setOffline(false);
  await offline.projection.locator("audio").waitFor({ state: "attached", timeout: 5000 });
  await offline.projection.reload({ waitUntil: "domcontentloaded" });
  await offline.projection.locator("audio").waitFor({ state: "attached", timeout: 5000 });
  await stopAll(onlineContext.request);
  await offline.projection.locator("audio").waitFor({ state: "detached", timeout: 5000 });
  await onlineContext.close();
  await offline.context.close();

  const multi = await openPair(browser);
  const displays = [multi.projection];
  // Scene controls intentionally navigate the registered projection. Open them
  // before the bot displays so this test exercises synchronization, not routing.
  for (const route of ["/glitch-controller", "/sound-control", "/queda-aviao-controller", "/forca-g-samples-controller"]) {
    const control = await multi.context.newPage();
    const response = await control.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
    assert.equal(response.status(), 200, `${route} must load successfully`);
  }
  for (let index = 0; index < 7; index += 1) {
    const display = await multi.context.newPage();
    await display.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await display.getByLabel("Cursor da Caixa Preta", { exact: true }).waitFor();
    displays.push(display);
  }
  await displays.shift().close();
  const frozen = displays.shift();
  const cdp = await multi.context.newCDPSession(frozen);
  await cdp.send("Page.setWebLifecycleState", { state: "frozen" });
  const marker = await multi.controller.evaluate(async () => {
    const response = await fetch("/api/operator", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "/say Confirme que o bot continua funcionando." }), signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error("command failed");
    // No API key in the isolated server: test the actual local fallback text.
    return (await fetch("/api/state").then(result => result.json())).publicMessage?.content;
  });
  assert(marker, "commands must still publish a message with bot and controller windows open");
  await Promise.all(displays.map(display => display.getByLabel("Fala atual da Caixa Preta", { exact: true }).getByText(marker, { exact: true }).waitFor({ timeout: 15000 })));
  await cdp.send("Page.setWebLifecycleState", { state: "active" });
  await frozen.getByLabel("Fala atual da Caixa Preta", { exact: true }).getByText(marker, { exact: true }).waitFor({ timeout: 15000 });
  for (const enabled of [true, false]) {
    await multi.controller.evaluate(async on => {
      const response = await fetch("/api/operator", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: `/blackout chatbot ${on ? "on" : "off"}` }), signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) throw new Error("blackout command failed");
    }, enabled);
    await Promise.all([...displays, frozen].map(display => display.locator('[data-blackout-target="chatbot"]').waitFor({ state: enabled ? "attached" : "detached" })));
  }
  await multi.context.close();
  console.log("public realtime browser tests passed: shared SSE, polling, offline/reload, eight public windows plus five controls, closed/frozen windows, browser commands and blackout recovery");
} finally {
  try {
    const cleanupContext = await browser.newContext();
    await stopAll(cleanupContext.request);
    await cleanupContext.close();
  } finally {
    await browser.close();
    server.kill("SIGTERM");
  }
}
