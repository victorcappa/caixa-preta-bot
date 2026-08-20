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

  setParam(graph.dryGain.gain, 1 - activeMix);
  setParam(graph.wetGain.gain, activeMix);
  setParam(graph.echoGain.gain, normalized.enabled ? normalized.echo : 0);
  setParam(graph.feedback.gain, normalized.enabled ? Math.min(0.68, normalized.echo * 0.72) : 0);
  setParam(graph.masterGain.gain, normalized.enabled ? normalized.output : 1);
  setParam(graph.highpass.frequency, normalized.lowCut);
  setParam(graph.lowpass.frequency, Math.max(normalized.lowCut + 20, normalized.highCut));
  setParam(graph.delay.delayTime, 0.08 + normalized.echo * 0.42);
  graph.shaper.curve = distortionCurve(normalized.enabled ? normalized.drive : 0);
  graph.shaper.oversample = normalized.drive > 0.5 ? "4x" : "2x";
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

  const source = context.createMediaElementSource(media);
  const dryGain = context.createGain();
  const highpass = context.createBiquadFilter();
  const lowpass = context.createBiquadFilter();
  const shaper = context.createWaveShaper();
  const wetGain = context.createGain();
  const delay = context.createDelay(1.2);
  const echoGain = context.createGain();
  const feedback = context.createGain();
  const masterGain = context.createGain();

  highpass.type = "highpass";
  lowpass.type = "lowpass";
  source.connect(dryGain).connect(masterGain);
  source.connect(highpass).connect(lowpass).connect(shaper).connect(wetGain).connect(masterGain);
  shaper.connect(delay).connect(echoGain).connect(masterGain);
  delay.connect(feedback).connect(delay);
  masterGain.connect(context.destination);

  const graph = {
    context,
    source,
    dryGain,
    highpass,
    lowpass,
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
  for (const node of [graph.source, graph.dryGain, graph.highpass, graph.lowpass, graph.shaper, graph.wetGain, graph.delay, graph.echoGain, graph.feedback, graph.masterGain]) {
    node.disconnect?.();
  }
  graphs.delete(media);
}
