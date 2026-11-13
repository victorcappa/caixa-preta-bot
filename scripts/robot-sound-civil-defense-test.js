import assert from "node:assert/strict";
import { RobotSoundEngine, robotSoundEngine } from "../lib/robot-sound/RobotSoundEngine.js";
import { GLOBAL_VOLUME_EVENT, GLOBAL_VOLUME_STORAGE_KEY } from "../lib/globalVolume.js";

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
const listeners = new Map();
const timers = new Map();
const storage = new Map();
let timerSequence = 0;
let fetchCalls = 0;
const buffer = { duration: 2.02 };

globalThis.window = {
  AudioContext: class {},
  localStorage: { getItem: (key) => storage.get(key) ?? null },
  addEventListener(type, listener) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(listener);
  },
  setTimeout(callback) { const id = ++timerSequence; timers.set(id, callback); return id; },
  clearTimeout(id) { timers.delete(id); }
};
globalThis.fetch = async (url) => {
  fetchCalls += 1;
  assert.equal(url, "/api/game-assets?file=audios/defesa-civil-primeiro-pulso.wav");
  return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
};

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function fixture() {
  const sources = [];
  const gains = [];
  const engine = new RobotSoundEngine();
  engine.context = {
    state: "running", currentTime: 5,
    decodeAudioData: async () => buffer,
    createGain() {
      const gain = {
        gain: {
          value: 0,
          setValueAtTime(value) { this.value = value; },
          setTargetAtTime(value) { this.value = value; }
        },
        connect(destination) { this.destination = destination; },
        disconnect() {}
      };
      gains.push(gain);
      return gain;
    },
    createBufferSource() {
      const source = new EventTarget();
      source.playbackRate = { value: 9 };
      source.start = () => { source.started = true; };
      source.stop = () => { source.stopped = true; source.dispatchEvent(new Event("ended")); };
      source.finish = () => source.dispatchEvent(new Event("ended"));
      source.connect = (destination) => { source.destination = destination; };
      source.disconnect = () => {};
      sources.push(source);
      return source;
    }
  };
  engine.effectsGain = { id: "existing-effects-gain" };
  return { engine, sources, gains };
}

const flush = () => new Promise(setImmediate);
function publishVolume(volume) {
  for (const listener of listeners.get(GLOBAL_VOLUME_EVENT) || []) listener({ type: GLOBAL_VOLUME_EVENT, detail: volume });
}

try {
  const local = fixture();
  const decoding = deferred();
  local.engine.context.decodeAudioData = () => decoding.promise;
  const firstPreparation = local.engine.prepareCivilDefenseAlert();
  assert.equal(local.engine.prepareCivilDefenseAlert(), firstPreparation, "simultaneous preparation shares one request");
  const localCompletion = local.engine.civilDefenseAlert({ cueId: "local", volumeScale: 0.4 });
  assert.equal(local.engine.civilDefenseAlert({ cueId: "local" }), localCompletion, "duplicate cues share playback completion");
  await flush();
  assert.equal(fetchCalls, 1);
  assert.equal(local.sources.length, 0, "playback waits for decoding");
  decoding.resolve(buffer);
  await firstPreparation;
  await flush();
  assert.equal(local.sources.length, 1);
  assert.equal(local.sources[0].buffer, buffer);
  assert.equal(local.sources[0].playbackRate.value, 1, "the approved sample keeps its original pitch and speed");
  assert.equal(local.gains[0].gain.value, 0.4);
  assert.equal(local.gains[0].destination, local.engine.effectsGain);
  let localEnded = false;
  void localCompletion.then(() => { localEnded = true; });
  await flush();
  assert.equal(localEnded, false, "typing must keep waiting while the sample plays");
  publishVolume(0);
  assert.equal(local.gains[0].gain.value, 0, "global mute updates the active sample");
  storage.set(GLOBAL_VOLUME_STORAGE_KEY, "0.2");
  for (const listener of listeners.get("storage") || []) listener({ type: "storage", key: GLOBAL_VOLUME_STORAGE_KEY });
  assert.equal(local.gains[0].gain.value, 0.2, "another window can update the sample volume");
  local.sources[0].finish();
  assert.equal(await localCompletion, true, "completion resolves at the actual ended event");
  assert.equal(local.engine.activeSources.size, 0);
  await local.engine.civilDefenseAlert({ cueId: "local" });
  assert.equal(local.sources.length, 1, "a completed cue is not replayed");
  const muted = local.engine.civilDefenseAlert({ cueId: "muted", volumeScale: 0 });
  assert.equal(await muted, false);
  assert.equal(local.sources.length, 1, "a muted cue creates no audio source");

  const pending = fixture();
  const pendingDecode = deferred();
  pending.engine.context.decodeAudioData = () => pendingDecode.promise;
  const pendingCompletion = pending.engine.civilDefenseAlert({ cueId: "stopped-before-decode" });
  await flush();
  pending.engine.stopAll({ localOnly: true });
  assert.equal(await pendingCompletion, false, "STOP ALL immediately releases a pending decode waiter");
  pendingDecode.resolve(buffer);
  await flush();
  assert.equal(pending.sources.length, 0, "late decoding cannot start a stopped cue");

  const producer = fixture();
  const sink = fixture();
  producer.engine.relaySinkId = "producer";
  producer.engine.relaySinks.set("sink", Date.now());
  sink.engine.relaySinkId = "sink";
  sink.engine.relaySinkUsers = 1;
  const messages = [];
  const acknowledgements = [];
  producer.engine.relayChannel = { postMessage(message) { messages.push(message); sink.engine.handleRelayMessage(message); } };
  sink.engine.relayChannel = { postMessage(message) { acknowledgements.push(message); producer.engine.handleRelayMessage(message); } };
  const relayCompletion = producer.engine.civilDefenseAlert({ cueId: "relayed", volumeScale: 0.5 });
  await flush();
  assert.equal(producer.sources.length, 0, "the producer does not duplicate the sink output");
  assert.equal(sink.sources.length, 1);
  sink.engine.handleRelayMessage({ ...messages[0], requestId: "second-producer-request" });
  await flush();
  assert.equal(sink.sources.length, 1, "duplicate relayed cue IDs play once at the sink");
  let relayEnded = false;
  void relayCompletion.then(() => { relayEnded = true; });
  await flush();
  assert.equal(relayEnded, false, "the producer waits for the sink's actual end");
  sink.sources[0].finish();
  assert.equal(await relayCompletion, true);
  await flush();
  assert.equal(acknowledgements.length, 2, "each waiting producer receives the shared playback result");
  assert.equal(producer.engine.civilDefenseAlertState.waiters.size, 0);

  const relayStopped = producer.engine.civilDefenseAlert({ cueId: "relay-stop" });
  await flush();
  producer.engine.stopAll();
  assert.equal(await relayStopped, false);
  assert.equal(sink.sources[1].stopped, true, "STOP ALL also stops a relayed active source");
  assert.equal(sink.engine.activeSources.size, 0);

  producer.engine.relayChannel = { postMessage() {} };
  const missingSink = producer.engine.civilDefenseAlert({ cueId: "missing-sink" });
  const missingSinkRecord = producer.engine.civilDefenseAlertState.cues.get("missing-sink");
  timers.get(missingSinkRecord.timer)();
  assert.equal(await missingSink, false, "a lost sink cannot block typing indefinitely");
  assert.equal(producer.engine.civilDefenseAlertState.waiters.size, 0);
  const bounded = [];
  for (let index = 0; index < 140; index += 1) bounded.push(local.engine.civilDefenseAlert({ cueId: `bounded-${index}`, volumeScale: 0 }));
  await Promise.all(bounded);
  assert.equal(local.engine.civilDefenseAlertState.cues.size, 128);

  const preservedContext = { state: "running" };
  robotSoundEngine.context = preservedContext;
  const preservedState = robotSoundEngine.civilDefenseAlertState;
  robotSoundEngine.civilDefenseAlert = () => assert.fail("old sample method must refresh");
  const refreshed = await import("../lib/robot-sound/RobotSoundEngine.js?civil-defense-refresh-test");
  assert.equal(refreshed.robotSoundEngine, robotSoundEngine);
  assert.equal(robotSoundEngine.context, preservedContext, "hot reload preserves the unlocked output");
  assert.equal(robotSoundEngine.civilDefenseAlertState, preservedState);
  assert.equal(robotSoundEngine.civilDefenseAlert, refreshed.RobotSoundEngine.prototype.civilDefenseAlert);
  console.log("PASS civil-defense audio: exact sample, load/cue deduplication, actual-end relay acknowledgement, mute, STOP ALL, timeout and hot refresh");
} finally {
  globalThis.window = originalWindow;
  globalThis.fetch = originalFetch;
}
