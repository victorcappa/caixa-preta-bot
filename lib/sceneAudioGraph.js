"use client";

import { normalizeSceneAudioEffects } from "./sceneAudioEffects";

let sharedContext = null;
const graphs = new WeakMap();

function distortionCurve(amount = 0) {
  const samples = 2048;
  const curve = new Float32Array(samples);
  const intensity = Math.max(0, Math.min(1, Number(amount) || 0));
  const gain = 1 + intensity * 180;

  for (let index = 0; index < samples; index += 1) {
    const x = (index * 2) / (samples - 1) - 1;
    curve[index] = intensity === 0
      ? x
      : ((Math.PI + gain) * x) / (Math.PI + gain * Math.abs(x));
  }

  return curve;
}

function setParam(param, value) {
  if (!param) return;
  const now = param.context?.currentTime || sharedContext?.currentTime || 0;
  param.cancelScheduledValues?.(now);
  param.setTargetAtTime?.(value, now, 0.015);
  if (!param.setTargetAtTime) param.value = value;
}

function applyGraph(graph, settings) {
  const normalized = normalizeSceneAudioEffects(settings);
  const activeMix = normalized.enabled ? normalized.mix : 0;
  const phaserDepth = normalized.enabled && normalized.phaserEnabled ? normalized.phaser : 0;
  const wahDepth = normalized.enabled && normalized.wahEnabled ? normalized.wah : 0;
  const echoAmount = normalized.enabled && normalized.echoEnabled ? normalized.echo : 0;

  setParam(graph.dryGain.gain, 1 - activeMix);
  setParam(graph.wetGain.gain, activeMix);
  setParam(graph.echoGain.gain, echoAmount);
  setParam(graph.feedback.gain, Math.min(0.68, echoAmount * 0.72));
  setParam(graph.masterGain.gain, normalized.enabled ? normalized.output : 1);
  setParam(graph.highpass.frequency, normalized.lowCut);
  setParam(graph.lowpass.frequency, Math.max(normalized.lowCut + 20, normalized.highCut));
  setParam(graph.delay.delayTime, 0.08 + echoAmount * 0.42);
  setParam(graph.phaserLfo.frequency, normalized.phaserRate);
  setParam(graph.phaserDepth.gain, phaserDepth * 1350);
  setParam(graph.phaserDryGain.gain, normalized.enabled && normalized.phaserEnabled ? 0 : 1);
  setParam(graph.phaserWetGain.gain, normalized.enabled && normalized.phaserEnabled ? 1 : 0);
  setParam(graph.wahLfo.frequency, normalized.wahRate);
  setParam(graph.wahDepth.gain, wahDepth * 2400);
  setParam(graph.wahFilter.frequency, 420 + wahDepth * 900);
  setParam(graph.wahFilter.Q, 1.2 + wahDepth * 10);
  setParam(graph.wahDryGain.gain, normalized.enabled && normalized.wahEnabled ? 0 : 1);
  setParam(graph.wahWetGain.gain, normalized.enabled && normalized.wahEnabled ? 1 : 0);
  graph.shaper.curve = distortionCurve(normalized.enabled && normalized.driveEnabled ? normalized.drive : 0);
  graph.shaper.oversample = normalized.drive > 0.5 ? "4x" : "2x";
  graph.media.preservesPitch = false;
  graph.media.webkitPreservesPitch = false;
  graph.media.playbackRate = normalized.enabled && normalized.pitchEnabled
    ? Math.pow(2, normalized.pitch / 12)
    : 1;
  graph.settings = normalized;
}

async function runningContext() {
  if (typeof window === "undefined" || !(window.AudioContext || window.webkitAudioContext)) return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  sharedContext ||= new AudioContextClass({ latencyHint: "interactive" });
  if (sharedContext.state !== "running" && sharedContext.state !== "closed") {
    await sharedContext.resume().catch(() => {});
  }
  return sharedContext.state === "running" ? sharedContext : null;
}

export async function attachSceneAudioEffects(media, settings) {
  if (!media) return null;
  const existing = graphs.get(media);
  if (existing) {
    applyGraph(existing, settings);
    return existing;
  }

  const context = await runningContext();
  if (!context) return null;
  const attachedWhileStarting = graphs.get(media);
  if (attachedWhileStarting) {
    applyGraph(attachedWhileStarting, settings);
    return attachedWhileStarting;
  }

  const source = context.createMediaElementSource(media);
  const dryGain = context.createGain();
  const highpass = context.createBiquadFilter();
  const lowpass = context.createBiquadFilter();
  const wahFilter = context.createBiquadFilter();
  const wahLfo = context.createOscillator();
  const wahDepth = context.createGain();
  const wahDryGain = context.createGain();
  const wahWetGain = context.createGain();
  const phaserInput = context.createGain();
  const phaserDryGain = context.createGain();
  const phaserWetGain = context.createGain();
  const phaserFilters = Array.from({ length: 4 }, () => context.createBiquadFilter());
  const phaserLfo = context.createOscillator();
  const phaserDepth = context.createGain();
  const shaper = context.createWaveShaper();
  const wetGain = context.createGain();
  const delay = context.createDelay(1.2);
  const echoGain = context.createGain();
  const feedback = context.createGain();
  const masterGain = context.createGain();

  highpass.type = "highpass";
  lowpass.type = "lowpass";
  wahFilter.type = "bandpass";
  phaserLfo.connect(phaserDepth);
  phaserFilters.forEach((filter, index) => {
    filter.type = "allpass";
    filter.frequency.value = 520 + index * 310;
    filter.Q.value = 0.8;
    phaserDepth.connect(filter.frequency);
  });
  wahLfo.connect(wahDepth).connect(wahFilter.frequency);
  source.connect(dryGain).connect(masterGain);
  const filtered = source.connect(highpass).connect(lowpass);
  filtered.connect(wahDryGain).connect(phaserInput);
  filtered.connect(wahFilter).connect(wahWetGain).connect(phaserInput);
  phaserInput.connect(phaserDryGain).connect(shaper);
  const phased = phaserFilters.reduce((node, filter) => node.connect(filter), phaserInput);
  phased.connect(phaserWetGain).connect(shaper);
  shaper.connect(wetGain).connect(masterGain);
  shaper.connect(delay).connect(echoGain).connect(masterGain);
  delay.connect(feedback).connect(delay);
  masterGain.connect(context.destination);
  phaserLfo.start();
  wahLfo.start();

  const graph = {
    context,
    media,
    source,
    dryGain,
    highpass,
    lowpass,
    wahFilter,
    wahLfo,
    wahDepth,
    wahDryGain,
    wahWetGain,
    phaserInput,
    phaserDryGain,
    phaserWetGain,
    phaserFilters,
    phaserLfo,
    phaserDepth,
    shaper,
    wetGain,
    delay,
    echoGain,
    feedback,
    masterGain,
    settings: null
  };
  graphs.set(media, graph);
  applyGraph(graph, settings);
  return graph;
}

export function updateSceneAudioEffects(media, settings) {
  const graph = media ? graphs.get(media) : null;
  if (graph) applyGraph(graph, settings);
  return Boolean(graph);
}

export function detachSceneAudioEffects(media) {
  const graph = media ? graphs.get(media) : null;
  if (!graph) return;
  graph.phaserLfo.stop?.();
  graph.wahLfo.stop?.();
  graph.media.playbackRate = 1;
  for (const node of [graph.source, graph.dryGain, graph.highpass, graph.lowpass, graph.wahFilter, graph.wahLfo, graph.wahDepth, graph.wahDryGain, graph.wahWetGain, graph.phaserInput, graph.phaserDryGain, graph.phaserWetGain, ...graph.phaserFilters, graph.phaserLfo, graph.phaserDepth, graph.shaper, graph.wetGain, graph.delay, graph.echoGain, graph.feedback, graph.masterGain]) {
    node.disconnect?.();
  }
  graphs.delete(media);
}
