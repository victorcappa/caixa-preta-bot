import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import { waitForAsyncCondition } from "./browser-test-utils.js";

const base = "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Audit denied", "NotAllowedError"); };
});
const actions = [];
const operator = await context.newPage();
let before;
let after;
try {
  const post = async (action, payload = {}) => {
    const response = await context.request.post(`${base}/api/audience-warmup`, { data: { action, ...payload } });
    assert.equal(response.ok(), true, action);
    return response.json();
  };
  await context.request.post(`${base}/api/operator`, { data: { command: "/reset" } });
  await operator.goto(`${base}/cena-0-controller`, { waitUntil: "domcontentloaded" });
  await post("set-manual-mode", { manualMode: true });
  let boot = await post("unlock-boot");
  while (boot.unlock.status === "BOOTING") boot = await post("unlock-advance-boot");
  await post("unlock-end-bios");
  await waitForAsyncCondition(operator, async () => (await (await fetch("/api/state")).json()).sceneZero.unlock.status === "SOUND_CHECK");
  await operator.waitForTimeout(4000);
  const snapshot = async () => {
    const s = await context.request.get(`${base}/api/state`).then((response) => response.json());
    return { stage: s.sceneZero.stage, unlock: s.sceneZero.unlock.status, sound: s.sceneZero.unlock.soundCheck.phase,
      pending: s.audienceWarmup.pendingAdvance?.kind, manual: s.audienceWarmup.manualMode, source: s.publicMessage?.source };
  };
  before = await snapshot();
  operator.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/audience-warmup")) actions.push(request.postDataJSON().action);
  });
  await operator.locator("#scene-zero-boot h2").click();
  await operator.keyboard.press("ArrowRight");
  await operator.waitForTimeout(1000);
  after = await snapshot();
  assert.equal(after.sound, "listening");
  assert(actions.includes("primary-next"));
  await post("unlock-sound-check-skip");
  console.log("Manual arrow and denied-microphone fallback passed", { before, after, actions });
} finally {
  await fs.writeFile("artifacts/bot-audit-2026-10-14/manual-sound-check.json", JSON.stringify({ before, after, actions }, null, 2));
  await browser.close();
}
