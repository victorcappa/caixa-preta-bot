import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { startAudienceMicrophoneMeter } from "../lib/audienceMicrophoneMeter.js";

let Processor;
const readings = [];
vm.runInNewContext(await fs.readFile(new URL("../public/audio-worklets/audience-meter.js", import.meta.url), "utf8"), {
  sampleRate: 48000,
  AudioWorkletProcessor: class { constructor() { this.port = { postMessage: (reading) => readings.push(reading) }; } },
  registerProcessor: (name, implementation) => { assert.equal(name, "caixa-preta-audience-meter"); Processor = implementation; }
});
const meter = new Processor();
const silentOutput = new Float32Array(2400);
meter.process([[new Float32Array(2400).fill(.25)]], [[silentOutput]]);
assert.equal(readings.length, 1);
assert.equal(readings[0].rms, .25);
assert.equal(readings[0].elapsedMs, 50);
assert(silentOutput.every((sample) => sample === 0), "never feed microphone audio back to speakers");
meter.process([], [[silentOutput]]);
assert.equal(readings[1].rms, 0, "missing input is silence, not an old loud sample");

let timerCallback;
let stopped = false;
globalThis.window = { setInterval: (callback) => { timerCallback = callback; return 17; },
  clearInterval: (id) => { assert.equal(id, 17); stopped = true; } };
const fallbackSamples = [];
const fallback = await startAudienceMicrophoneMeter({ context: {}, analyser: {
  fftSize: 8, getFloatTimeDomainData: (samples) => samples.fill(.125)
}, onSample: (sample) => fallbackSamples.push(sample) });
assert.equal(fallback.mode, "analyser-timer");
timerCallback();
assert.equal(fallbackSamples[0].rms, .125);
fallback.stop();
assert(stopped, "fallback timer must be released");
delete globalThis.window;
console.log("Audience microphone meter PASS: audio clock, real RMS, silence, no feedback and fallback cleanup");
