import {
  classifyRobotSoundCharacter,
  normalizeRobotSoundSettings,
  ROBOT_SOUND_DEFAULTS,
  ROBOT_SOUND_PRESETS
} from "./state.js";

const MAX_ACTIVE_VOICES = 14;
const MIN_EVENT_GAP_MS = 11;
const AUDIO_RELAY_CHANNEL = "caixa-preta-robot-sound";
const AUDIO_RELAY_TTL_MS = 2600;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export class RobotSoundEngine {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.typingGain = null;
    this.effectsGain = null;
    this.compressor = null;
    this.noiseBuffer = null;
    this.settings = normalizeRobotSoundSettings(ROBOT_SOUND_DEFAULTS);
    this.glitch = { active: false, intensity: 0, ghostTyping: false, sequence: 0 };
    this.activeSources = new Set();
    this.timers = new Set();
    this.thinking = false;
    this.lastTypingAt = 0;
    this.lastGlitchSequence = 0;
    this.sampleLayers = new Map();
    this.statusListeners = new Set();
    this.reconnectPromise = null;
    this.relayChannel = null;
    this.relayUsers = 0;
    this.relaySinkUsers = 0;
    this.relaySinkId = null;
    this.relayHeartbeat = null;
    this.lastRelaySinkAt = 0;
    this.thinkingRelayed = false;
  }

  get supported() {
    return typeof window !== "undefined" && Boolean(window.AudioContext || window.webkitAudioContext);
  }

  ensureContext() {
    if (!this.supported) return null;
    if (this.context && this.context.state !== "closed") return this.context;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass({ latencyHint: "interactive" });
    const masterGain = context.createGain();
    const typingGain = context.createGain();
    const effectsGain = context.createGain();
    const compressor = context.createDynamicsCompressor();

    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.08;
    typingGain.connect(masterGain);
    effectsGain.connect(masterGain);
    masterGain.connect(compressor);
    compressor.connect(context.destination);

    this.context = context;
    this.masterGain = masterGain;
    this.typingGain = typingGain;
    this.effectsGain = effectsGain;
    this.compressor = compressor;
    this.noiseBuffer = this.createNoiseBuffer(context);
    context.addEventListener?.("statechange", () => this.notifyStatus());
    this.applyGainSettings();
    this.notifyStatus();
    return context;
  }

  createNoiseBuffer(context) {
    const length = Math.ceil(context.sampleRate * 0.09);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  async unlock() {
    const context = this.ensureContext();
    if (!context) return false;
    if (context.state !== "running" && context.state !== "closed") {
      await context.resume().catch(() => {});
    }
    this.notifyStatus();
    return context.state === "running";
  }

  armAutoUnlock() {
    if (typeof window === "undefined") return () => {};
    const unlock = () => { void this.unlock(); };
    const recover = () => {
      if (document.visibilityState === "visible" && this.context?.state !== "running") {
        void this.unlock();
      }
    };
    const recoverOutput = () => {
      if (this.settings.enabled) void this.reconnectOutput();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock, { passive: true });
    window.addEventListener("focus", recover);
    document.addEventListener("visibilitychange", recover);
    navigator.mediaDevices?.addEventListener?.("devicechange", recoverOutput);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("focus", recover);
      document.removeEventListener("visibilitychange", recover);
      navigator.mediaDevices?.removeEventListener?.("devicechange", recoverOutput);
    };
  }

  outputStatus() {
    if (!this.supported) return "UNSUPPORTED";
    if (!this.context) return "LOCKED";
    return `${this.context.state || "unknown"}`.toUpperCase();
  }

  subscribeStatus(listener) {
    if (typeof listener !== "function") return () => {};
    this.statusListeners.add(listener);
    listener(this.outputStatus());
    return () => this.statusListeners.delete(listener);
  }

  notifyStatus() {
    const status = this.outputStatus();
    for (const listener of this.statusListeners) listener(status);
    if (status === "RUNNING") this.announceRelaySink();
  }

  armAudioRelay({ sink = false } = {}) {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return () => {};
    this.relayUsers += 1;
    if (sink) this.relaySinkUsers += 1;

    if (!this.relayChannel) {
      this.relaySinkId ||= crypto.randomUUID();
      this.relayChannel = new BroadcastChannel(AUDIO_RELAY_CHANNEL);
      this.relayChannel.addEventListener("message", (event) => this.handleRelayMessage(event.data));
      this.relayChannel.postMessage({ type: "discover" });
      this.relayHeartbeat = window.setInterval(() => this.announceRelaySink(), 900);
    }
    this.announceRelaySink();

    return () => {
      this.relayUsers = Math.max(0, this.relayUsers - 1);
      if (sink) this.relaySinkUsers = Math.max(0, this.relaySinkUsers - 1);
      if (this.relayUsers > 0) return;
      window.clearInterval(this.relayHeartbeat);
      this.relayHeartbeat = null;
      this.relayChannel?.close();
      this.relayChannel = null;
      this.lastRelaySinkAt = 0;
    };
  }

  announceRelaySink() {
    if (!this.relayChannel || this.relaySinkUsers < 1 || this.context?.state !== "running") return;
    this.relayChannel.postMessage({ type: "sink", sinkId: this.relaySinkId, sentAt: Date.now() });
  }

  handleRelayMessage(message = {}) {
    if (message.type === "discover") {
      this.announceRelaySink();
      return;
    }
    if (message.type === "sink") {
      this.lastRelaySinkAt = Date.now();
      return;
    }
    if (message.type !== "play" || this.relaySinkUsers < 1 || this.context?.state !== "running") return;

    if (message.effect === "typing") this.typing(message.character, { force: message.force, localOnly: true });
    if (message.effect === "wake") this.wake({ localOnly: true });
    if (message.effect === "complete") this.complete({ localOnly: true });
    if (message.effect === "countdown") this.countdown(message.value, { localOnly: true });
    if (message.effect === "thinking-start") this.startThinking({ localOnly: true });
    if (message.effect === "thinking-stop") this.stopThinking({ localOnly: true });
    if (message.effect === "success") this.success({ localOnly: true });
    if (message.effect === "error") this.error({ localOnly: true });
    if (message.effect === "glitch") this.glitchEffect({ localOnly: true, intensity: message.intensity });
    if (message.effect === "impact") this.impact({ localOnly: true });
    if (message.effect === "stop-all") this.stopAll({ localOnly: true });
  }

  relayEffect(effect, detail = {}) {
    if (!this.relayChannel || Date.now() - this.lastRelaySinkAt > AUDIO_RELAY_TTL_MS) return false;
    this.relayChannel.postMessage({ type: "play", effect, ...detail });
    return true;
  }

  async reconnectOutput() {
    if (!this.supported) {
      this.notifyStatus();
      return false;
    }
    if (this.reconnectPromise) return this.reconnectPromise;

    this.reconnectPromise = (async () => {
      const restartThinking = this.thinking;
      const restartGhostTyping = this.glitch.active && this.glitch.ghostTyping;
      const previousContext = this.context;
      this.stopAll();

      this.context = null;
      this.masterGain = null;
      this.typingGain = null;
      this.effectsGain = null;
      this.compressor = null;
      this.noiseBuffer = null;

      // Create/resume the replacement in the original click stack. Safari can
      // reject a new AudioContext when an awaited close() has already consumed
      // the transient user activation that triggered recovery.
      const closePromise = previousContext && previousContext.state !== "closed"
        ? previousContext.close().catch(() => {})
        : Promise.resolve();
      const context = this.ensureContext();
      const resumePromise = context?.state !== "running"
        ? context?.resume().catch(() => {})
        : Promise.resolve();
      await Promise.all([closePromise, resumePromise]);
      this.applyGainSettings();
      if (restartThinking) this.startThinking();
      if (restartGhostTyping) this.scheduleGhostTyping();
      this.notifyStatus();
      return context?.state === "running";
    })();

    try {
      return await this.reconnectPromise;
    } finally {
      this.reconnectPromise = null;
    }
  }

  setSettings(settings = {}) {
    this.settings = normalizeRobotSoundSettings(settings, this.settings);
    this.applyGainSettings();
    if (!this.settings.enabled) this.stopAll();
  }

  applyGainSettings() {
    if (!this.context || !this.masterGain) return;
    const now = this.context.currentTime;
    this.masterGain.gain.setTargetAtTime(this.settings.enabled ? this.settings.masterVolume : 0, now, 0.012);
    this.typingGain.gain.setTargetAtTime(this.settings.typingVolume, now, 0.012);
    this.effectsGain.gain.setTargetAtTime(0.72, now, 0.012);
  }

  setGlitch(glitch = {}) {
    const sequence = Number(glitch.sequence || 0);
    const intensity = clamp(Number(glitch.audio?.typingIntensity ?? glitch.params?.intensity ?? 0), 0, 1);
    const nextGlitch = {
      active: Boolean(glitch.active),
      intensity,
      ghostTyping: Boolean(glitch.audio?.ghostTyping),
      sequence
    };
    const changed = nextGlitch.active !== this.glitch.active ||
      nextGlitch.intensity !== this.glitch.intensity ||
      nextGlitch.ghostTyping !== this.glitch.ghostTyping ||
      nextGlitch.sequence !== this.glitch.sequence;

    if (!changed) return;

    const wasActive = this.glitch.active;
    this.glitch = nextGlitch;

    this.clearGhostTimers();
    if (this.glitch.active && this.glitch.ghostTyping) this.scheduleGhostTyping();
    if (this.glitch.active && (!wasActive || sequence !== this.lastGlitchSequence)) this.glitchEffect();
    this.lastGlitchSequence = sequence;
  }

  canPlay() {
    return Boolean(
      this.settings.enabled &&
      this.context &&
      this.context.state === "running" &&
      this.activeSources.size < MAX_ACTIVE_VOICES
    );
  }

  registerSampleLayer(eventName, player) {
    if (typeof player !== "function") {
      this.sampleLayers.delete(eventName);
      return;
    }
    this.sampleLayers.set(eventName, player);
  }

  playSampleLayer(eventName, detail = {}) {
    if (!this.settings.enabled) return;
    try { this.sampleLayers.get(eventName)?.(detail); } catch {}
  }

  trackSource(source, nodes = []) {
    this.activeSources.add(source);
    source.addEventListener("ended", () => {
      this.activeSources.delete(source);
      for (const node of [source, ...nodes]) {
        try { node.disconnect(); } catch {}
      }
    }, { once: true });
  }

  scheduleTimer(callback, delayMs, kind = "general") {
    const entry = { id: null, kind };
    entry.id = window.setTimeout(() => {
      this.timers.delete(entry);
      callback();
    }, delayMs);
    this.timers.add(entry);
    return entry;
  }

  clearGhostTimers() {
    for (const timer of [...this.timers]) {
      if (timer.kind === "ghost") {
        window.clearTimeout(timer.id);
        this.timers.delete(timer);
      }
    }
  }

  typing(character, { force = false, localOnly = false } = {}) {
    if (!localOnly && this.relayEffect("typing", { character, force })) return;
    if (!this.canPlay()) return;
    const nowMs = performance.now();
    if (!force && nowMs - this.lastTypingAt < MIN_EVENT_GAP_MS) return;
    this.lastTypingAt = nowMs;

    const kind = classifyRobotSoundCharacter(character);
    if (kind === "space" && Math.random() < 0.82) return;
    if (Math.random() >= this.settings.typingFrequency) return;
    if (this.glitch.active && Math.random() < this.glitch.intensity * 0.1) return;

    const preset = ROBOT_SOUND_PRESETS[this.settings.preset] || ROBOT_SOUND_PRESETS.normal;
    const characterShape = {
      key: { pitch: 1, level: 1, duration: 1, noise: 1 },
      space: { pitch: 0.72, level: 0.18, duration: 0.72, noise: 0.5 },
      pause: { pitch: 0.8, level: 0.72, duration: 1.22, noise: 0.85 },
      period: { pitch: 0.56, level: 1.16, duration: 1.45, noise: 1.1 },
      emphasis: { pitch: 1.32, level: 1.02, duration: 1.18, noise: 0.9 },
      return: { pitch: 0.46, level: 1.08, duration: 1.75, noise: 1.18 }
    }[kind];
    const glitchPitch = this.glitch.active
      ? randomBetween(1 - this.glitch.intensity * 0.36, 1 + this.glitch.intensity * 0.42)
      : 1;

    this.click({
      pitch: preset.pitch * characterShape.pitch * glitchPitch,
      pitchVariation: preset.pitchVariation + (this.glitch.active ? this.glitch.intensity * 0.1 : 0),
      durationMs: preset.durationMs * characterShape.duration * randomBetween(0.86, 1.14),
      attackMs: preset.attackMs * randomBetween(0.72, 1.28),
      decayMs: preset.decayMs * characterShape.duration * randomBetween(0.82, 1.2),
      noise: preset.noise * characterShape.noise * randomBetween(0.82, 1.18),
      filterHz: preset.filterHz * randomBetween(0.82, 1.18),
      level: preset.level * characterShape.level * randomBetween(0.82, 1.1),
      destination: this.typingGain
    });

    if (this.glitch.active && Math.random() < this.glitch.intensity * 0.22) {
      this.scheduleTimer(() => this.typing(character, { force: true }), randomBetween(11, 36), "glitch");
    }
  }

  click(options) {
    if (!this.canPlay()) return;
    const context = this.context;
    const start = context.currentTime + 0.001;
    const duration = clamp(options.durationMs / 1000, 0.008, 0.09);
    const attack = clamp(options.attackMs / 1000, 0.0003, duration * 0.35);
    const decay = clamp(options.decayMs / 1000, attack + 0.002, duration);
    const level = clamp(options.level, 0.005, 0.72);

    const oscillator = context.createOscillator();
    const oscillatorGain = context.createGain();
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    const destination = options.destination || this.effectsGain;

    oscillator.type = "square";
    oscillator.frequency.value = options.pitch * randomBetween(1 - options.pitchVariation, 1 + options.pitchVariation);
    oscillator.detune.setValueAtTime(randomBetween(-12, 12), start);
    oscillatorGain.gain.setValueAtTime(0.0001, start);
    oscillatorGain.gain.exponentialRampToValueAtTime(level, start + attack);
    oscillatorGain.gain.exponentialRampToValueAtTime(0.0001, start + decay);

    noise.buffer = this.noiseBuffer;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = clamp(options.filterHz, 260, 9000);
    noiseFilter.Q.value = randomBetween(0.65, 1.5);
    noiseGain.gain.setValueAtTime(0.0001, start);
    noiseGain.gain.exponentialRampToValueAtTime(clamp(level * options.noise, 0.0002, 0.58), start + attack * 0.7);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, start + decay * 0.92);

    oscillator.connect(oscillatorGain).connect(destination);
    noise.connect(noiseFilter).connect(noiseGain).connect(destination);
    this.trackSource(oscillator, [oscillatorGain]);
    this.trackSource(noise, [noiseFilter, noiseGain]);
    oscillator.start(start);
    noise.start(start);
    oscillator.stop(start + duration);
    noise.stop(start + duration);
  }

  tone({ from, to = from, durationMs, level = 0.1, type = "sine" }) {
    if (!this.canPlay()) return;
    const context = this.context;
    const start = context.currentTime + 0.002;
    const end = start + durationMs / 1000;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), end);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain).connect(this.effectsGain);
    this.trackSource(oscillator, [gain]);
    oscillator.start(start);
    oscillator.stop(end + 0.002);
  }

  wake({ localOnly = false } = {}) {
    this.stopThinking({ localOnly });
    if (!localOnly && this.relayEffect("wake")) return;
    this.playSampleLayer("wake");
    this.tone({ from: 170, to: 760, durationMs: 72, level: 0.075, type: "sawtooth" });
    this.scheduleTimer(() => this.click({ pitch: 1360, pitchVariation: 0.03, durationMs: 18, attackMs: 1, decayMs: 14, noise: 0.22, filterHz: 3800, level: 0.2 }), 34);
  }

  complete({ localOnly = false } = {}) {
    if (!localOnly && this.relayEffect("complete")) return;
    if (!this.settings.completeEnabled) return;
    this.playSampleLayer("complete");
    this.tone({ from: 540, to: 390, durationMs: 58, level: 0.045, type: "triangle" });
  }

  countdown(value, { localOnly = false } = {}) {
    const seconds = Math.max(0, Math.round(Number(value) || 0));
    if (!localOnly && this.relayEffect("countdown", { value: seconds })) return;
    if (!this.canPlay()) return;

    if (seconds === 0) {
      this.playSampleLayer("countdownComplete");
      this.click({ pitch: 220, pitchVariation: 0.015, durationMs: 62, attackMs: 2, decayMs: 54, noise: 0.46, filterHz: 880, level: 0.34 });
      this.scheduleTimer(() => this.tone({ from: 440, to: 110, durationMs: 190, level: 0.12, type: "square" }), 22, "countdown");
      return;
    }

    const urgency = seconds <= 3 ? 1 : 0;
    this.playSampleLayer("countdown", { value: seconds, urgency: Boolean(urgency) });
    this.click({
      pitch: urgency ? 1180 + ((3 - seconds) * 150) : 820,
      pitchVariation: 0.012,
      durationMs: urgency ? 42 : 30,
      attackMs: 1,
      decayMs: urgency ? 35 : 24,
      noise: urgency ? 0.22 : 0.14,
      filterHz: urgency ? 3600 : 2500,
      level: urgency ? 0.3 : 0.2
    });
  }

  success({ localOnly = false } = {}) {
    if (!localOnly && this.relayEffect("success")) return;
    this.playSampleLayer("success");
    this.click({ pitch: 620, pitchVariation: 0.025, durationMs: 42, attackMs: 2, decayMs: 35, noise: 0.38, filterHz: 1900, level: 0.32 });
    this.scheduleTimer(() => this.tone({ from: 310, to: 430, durationMs: 62, level: 0.07, type: "square" }), 24);
  }

  error({ localOnly = false } = {}) {
    if (!localOnly && this.relayEffect("error")) return;
    this.playSampleLayer("error");
    this.tone({ from: 540, to: 105, durationMs: 105, level: 0.11, type: "sawtooth" });
    this.scheduleTimer(() => this.click({ pitch: 230, pitchVariation: 0.18, durationMs: 36, attackMs: 1, decayMs: 24, noise: 0.82, filterHz: 980, level: 0.28 }), 38);
  }

  glitchEffect({ localOnly = false, intensity = this.glitch.intensity } = {}) {
    if (!localOnly && this.relayEffect("glitch", { intensity })) return;
    if (!this.canPlay()) return;
    const normalizedIntensity = Math.max(0.3, Number(intensity) || 0.55);
    this.playSampleLayer("glitch", { intensity: normalizedIntensity });
    for (let index = 0; index < 2 + Math.round(normalizedIntensity * 2); index += 1) {
      this.scheduleTimer(() => this.click({
        pitch: randomBetween(180, 2100), pitchVariation: 0.2, durationMs: randomBetween(10, 34),
        attackMs: 0.6, decayMs: randomBetween(8, 26), noise: randomBetween(0.4, 1),
        filterHz: randomBetween(500, 5200), level: 0.16 + normalizedIntensity * 0.12
      }), index * randomBetween(12, 31), "glitch");
    }
  }

  impact({ localOnly = false } = {}) {
    if (!localOnly && this.relayEffect("impact")) return;
    this.playSampleLayer("impact");
    this.tone({ from: 118, to: 46, durationMs: 180, level: 0.15, type: "sine" });
    this.click({ pitch: 94, pitchVariation: 0.02, durationMs: 58, attackMs: 2, decayMs: 52, noise: 0.55, filterHz: 520, level: 0.3 });
  }

  startThinking({ localOnly = false } = {}) {
    if (this.thinking || !this.settings.enabled) return;
    this.thinking = true;
    if (!localOnly && this.relayEffect("thinking-start")) {
      this.thinkingRelayed = true;
      return;
    }
    this.thinkingRelayed = false;
    const pulse = () => {
      if (!this.thinking) return;
      if (this.canPlay()) {
        this.click({ pitch: randomBetween(210, 390), pitchVariation: 0.06, durationMs: 28, attackMs: 3, decayMs: 23, noise: 0.18, filterHz: 1200, level: 0.055 });
      }
      this.scheduleTimer(pulse, randomBetween(520, 1450), "thinking");
    };
    this.scheduleTimer(pulse, randomBetween(180, 520), "thinking");
  }

  stopThinking({ localOnly = false } = {}) {
    if (!localOnly && this.thinkingRelayed) this.relayEffect("thinking-stop");
    this.thinking = false;
    this.thinkingRelayed = false;
    for (const timer of [...this.timers]) {
      if (timer.kind === "thinking") {
        window.clearTimeout(timer.id);
        this.timers.delete(timer);
      }
    }
  }

  scheduleGhostTyping() {
    if (!this.glitch.active || !this.glitch.ghostTyping) return;
    this.scheduleTimer(() => {
      if (!this.glitch.active || !this.glitch.ghostTyping) return;
      this.typing("x", { force: true });
      this.scheduleGhostTyping();
    }, randomBetween(480, 1800), "ghost");
  }

  stopAll({ localOnly = false } = {}) {
    if (!localOnly) this.relayEffect("stop-all");
    this.thinking = false;
    this.thinkingRelayed = false;
    for (const timer of this.timers) window.clearTimeout(timer.id);
    this.timers.clear();
    for (const source of [...this.activeSources]) {
      try { source.stop(); } catch {}
      try { source.disconnect(); } catch {}
    }
    this.activeSources.clear();
  }
}

const globalKey = "__caixaPretaRobotSoundEngine";
export const robotSoundEngine = globalThis[globalKey] || new RobotSoundEngine();
globalThis[globalKey] = robotSoundEngine;
