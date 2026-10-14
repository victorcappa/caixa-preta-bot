import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = "http://localhost:3000";
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

async function openPair(browser, { blockPublicSse = false, trackSources = false } = {}) {
  const context = await browser.newContext();
  if (trackSources) await context.addInitScript(() => {
    const NativeEventSource = window.EventSource;
    window.__auditEventSources = [];
    window.EventSource = class extends NativeEventSource {
      constructor(...args) {
        super(...args);
        window.__auditEventSources.push(this);
      }
    };
  });

  if (blockPublicSse) {
    await context.route("**/api/events?client=public-display", (route) => route.abort());
  }

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

  const fallback = await openPair(browser, { blockPublicSse: true });
  await stopAll(fallback.context.request);
  await fallback.projection.locator("audio").waitFor({ state: "detached" });
  await clickCueAction(fallback.controller, "Tocar Tea For Two", "play");
  await fallback.projection.locator("audio").waitFor({ state: "attached", timeout: 2000 });
  const fallbackStop = await clickCueAction(fallback.controller, "SILÊNCIO / STOP ALL", "stop-all");
  assert.equal(fallbackStop.state.audioCues.some((cue) => cue.controllerId === CONTROLLER_ID), false);
  await fallback.projection.locator("audio").waitFor({ state: "detached", timeout: 2000 });
  await fallback.context.close();

  const offline = await openPair(browser, { trackSources: true });
  await stopAll(offline.context.request);
  await offline.projection.locator("audio").waitFor({ state: "detached" });
  await offline.context.setOffline(true);
  // Offline emulation does not reliably tear down already-open SSE sockets.
  for (const page of [offline.projection, offline.controller]) await page.evaluate(() => {
    for (const source of window.__auditEventSources) {
      source.close();
      source.dispatchEvent(new Event("error"));
    }
  });
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
  console.log("public realtime browser tests passed: SSE, reconciliation, offline clients, reconnect and reload");
} finally {
  const cleanupContext = await browser.newContext();
  await stopAll(cleanupContext.request);
  await cleanupContext.close();
  await browser.close();
}
