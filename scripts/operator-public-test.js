import { normalizePublicComposition, patchPublicComposition } from "../lib/publicComposition.js";
import { extractOperatorPreferences, applyOperatorPreferences } from "../lib/operatorPreferences.js";
import assert from "node:assert/strict";
import { createOperatorPublicState, normalizePersonality, operatorPublicSnapshot, operatorShowContext,
  personalityPrompt, relevantPersonalityChanges } from "../lib/operatorPublic.js";
import { runExternalRequest } from "../lib/externalRequestControl.js";
import { getInstagramController, getExistingInstagramController, retireInstagramController } from "../lib/instagram/InstagramController.js";

const channel = createOperatorPublicState();
assert.deepEqual(normalizePersonality({ sarcasm: 120, rebellion: -10, curiosity: NaN, verbosity: 18.7 }),
  { sarcasm: 100, rebellion: 0, curiosity: 70, verbosity: 19 });
channel.error = "private diagnostic";
channel.requestId = "private request";
channel.changes = [{ parameter: "sarcasm", from: 20, to: 30, at: Date.now() - 50 },
  { parameter: "sarcasm", from: 30, to: 90, at: Date.now() }];
assert.equal(operatorPublicSnapshot(channel).error, undefined);
assert.equal(operatorPublicSnapshot(channel).changes, undefined);
assert.equal(operatorPublicSnapshot(channel, { includePrivate: true }).error, "private diagnostic");
assert.equal(relevantPersonalityChanges(channel).length, 1);
assert.equal(relevantPersonalityChanges(channel)[0].from, 20);
channel.lastReactionAt = Date.now();
assert.equal(relevantPersonalityChanges(channel).length, 0);
assert.match(personalityPrompt({ sarcasm: 90 }), /SARCASMO: 90%/);
assert.match(personalityPrompt({ sarcasm: 10 }), /SARCASMO: 10%/);
const context = operatorShowContext({ sceneZero: { stage: "suitcases" },
  instagram: { status: "NAVIGATING", currentUrl: "https://instagram.com/", profileDir: "secret", logs: ["private"] },
  variables: { apiKey: "secret" }, memories: [{ content: "private" }] });
assert.equal(context.scene, "suitcases");
assert.equal(context.instagram.contentAvailable, false);
assert(!JSON.stringify(context).includes("secret"));
const controller = new AbortController();
const request = runExternalRequest("operator-test", (signal) => new Promise((resolve, reject) => {
  signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
}), { signal: controller.signal });
controller.abort();
await assert.rejects(request, /cancelled/);
let reports = 0;
const instagram = getInstagramController({ reporter: () => { reports += 1; } });
const initialGeneration = instagram.googleGuidanceGeneration;
await instagram.stopAllRoutines();
assert(instagram.googleGuidanceGeneration > initialGeneration, "stop invalidates Google guidance callbacks");
const retired = retireInstagramController();
assert.equal(retired, instagram);
assert.equal(getExistingInstagramController(), null);
const beforeReports = reports;
retired.updateStatus("NAVIGATING", "late callback must be ignored");
assert.equal(reports, beforeReports);
await assert.rejects(retired.init(), /INSTAGRAM_ACTIVITY_RETIRED/);
assert.throws(() => retired.ensurePage(), /INSTAGRAM_ACTIVITY_RETIRED/);
const fresh = getInstagramController();
assert.notEqual(fresh.controllerId, retired.controllerId);
retireInstagramController();
console.log("OPERATOR PUBLIC: normalization, public/private boundary, context, reaction cooldown and cancellation PASS");

const composition = normalizePublicComposition({ textColor: "url(secret)", modules: {
  "main-speech": { x: 95, y: -2, width: 80, height: Infinity },
  "private-controls": { x: 0, y: 0, width: 100, height: 100 }
} });
assert.equal(composition.textColor,"#00ff66");
assert.deepEqual(composition.modules["main-speech"],{x:90,y:0,width:10,height:100});
assert.equal(composition.modules["private-controls"],undefined);
const patched = patchPublicComposition(composition,{textColor:"#ffffff",modules:{"tarot-speech":{x:2,y:3,width:80,height:30}}});
assert.deepEqual(patched.modules["main-speech"],composition.modules["main-speech"],"editing tarot preserves other modules");
assert.equal(patchPublicComposition(patched,{modules:{"tarot-speech":null}}).modules["tarot-speech"],undefined);
channel.composition=patched;
assert.deepEqual(operatorPublicSnapshot(channel).composition,patched);
const restored=applyOperatorPreferences({operatorPublic:createOperatorPublicState()},extractOperatorPreferences({operatorPublic:channel}));
assert.deepEqual(restored.operatorPublic.composition,patched,"composition survives operator preferences roundtrip");
console.log("PUBLIC COMPOSITION: bounded geometry, allowlisted modules, independent patches, reset, public snapshot and preferences PASS");
