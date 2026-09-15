const assert = require("node:assert/strict");

async function main() {
  const sound = await import("../lib/robot-sound/state.js");
  const engineModule = await import("../lib/robot-sound/RobotSoundEngine.js");
  const glitch = await import("../lib/glitch/state.js");
  const unlock = await import("../data/scene-zero-unlock.js");

  const initial = sound.createInitialRobotSoundState();
  assert.equal(initial.enabled, true);
  assert.equal(initial.soundStyle, "system95");
  assert.equal(initial.soundStyleVersion, sound.ROBOT_SOUND_STYLE_VERSION);
  assert.equal(initial.preset, "normal");
  assert.equal(initial.pitchScale, 1);
  assert.equal(initial.microphoneSensitivity, 1);
  assert.equal(initial.typingFrequency, 0.35);
  assert.equal(initial.typingIntervalMs, 60);
  assert.equal(initial.outputResetSequence, 0);
  assert(initial.masterVolume > 0 && initial.masterVolume < 0.5);

  const normalized = sound.normalizeRobotSoundSettings({
    enabled: false,
    masterVolume: 4,
    typingVolume: -2,
    pitchScale: 4,
    microphoneSensitivity: 8,
    typingFrequency: 4,
    outputResetSequence: -4,
    preset: "unknown",
    soundStyle: "unknown"
  });
  assert.equal(normalized.enabled, false);
  assert.equal(normalized.masterVolume, 1);
  assert.equal(normalized.typingVolume, 0);
  assert.equal(normalized.pitchScale, 2);
  assert.equal(normalized.microphoneSensitivity, 3);
  assert.equal(normalized.typingFrequency, 1);
  assert.equal(normalized.preset, "normal");
  assert.equal(normalized.soundStyle, "system95");
  assert.equal(normalized.outputResetSequence, 0);

  assert.equal(sound.normalizeRobotSoundSettings({ typingFrequency: -1 }).typingFrequency, 0);
  assert.equal(sound.normalizeRobotSoundSettings({ pitchScale: 0.1 }).pitchScale, 0.5);
  assert.equal(sound.normalizeRobotSoundSettings({ microphoneSensitivity: 0 }).microphoneSensitivity, 0.25);
  assert.equal(sound.robotMicrophoneSensitivity({ microphoneSensitivity: 1.75 }), 1.75);
  assert.equal(sound.normalizeRobotSoundSettings({ soundStyle: "system95" }).soundStyle, "system95");
  assert.equal(sound.normalizeRobotSoundSettings({ soundStyle: "robot" }).soundStyle, "system95");
  assert.equal(sound.normalizeRobotSoundSettings({
    soundStyle: "robot",
    soundStyleVersion: sound.ROBOT_SOUND_STYLE_VERSION
  }).soundStyle, "robot");

  assert.equal(sound.classifyRobotSoundCharacter("A"), "key");
  assert.equal(sound.classifyRobotSoundCharacter(" "), "space");
  assert.equal(sound.classifyRobotSoundCharacter(","), "pause");
  assert.equal(sound.classifyRobotSoundCharacter("."), "period");
  assert.equal(sound.classifyRobotSoundCharacter("?"), "emphasis");
  assert.equal(sound.classifyRobotSoundCharacter("\n"), "return");

  assert.deepEqual(sound.ROBOT_SOUND_PRESET_NAMES, ["normal", "seco", "mecanico", "instavel"]);
  assert.deepEqual(sound.ROBOT_SOUND_STYLE_NAMES, ["robot", "system95"]);
  assert.deepEqual(Object.keys(unlock.PLAY_UNLOCK_CONFIG.system95Sounds), [
    "tick", "warning", "progress", "verification", "unlock"
  ]);
  assert(unlock.PLAY_UNLOCK_CONFIG.system95Sounds.unlock.frequencies.length > 1);
  assert.equal(glitch.glitchAudioForPreset("normal").ghostTyping, false);
  assert.equal(glitch.glitchAudioForPreset("strong").ghostTyping, true);
  assert.equal(glitch.publicGlitchSnapshot({
    ...glitch.createInitialGlitchState(),
    active: true,
    preset: "strong",
    audio: glitch.glitchAudioForPreset("strong")
  }).audio.ghostTyping, true);

  const originalWindow = globalThis.window;
  const originalRandom = Math.random;
  globalThis.window = { setTimeout, clearTimeout };
  Math.random = () => 0;
  const engine = new engineModule.RobotSoundEngine();
  const typingClicks = [];
  engine.relayEffect = () => false;
  engine.canPlay = () => true;
  engine.typingGain = { id: "typing-gain" };
  engine.effectsGain = { id: "effects-gain" };
  engine.click = (options) => { typingClicks.push(options); };
  engine.setSettings({
    ...engine.settings,
    soundStyle: "robot",
    soundStyleVersion: sound.ROBOT_SOUND_STYLE_VERSION,
    typingFrequency: 0
  });
  engine.typing("A", { force: true, localOnly: true });
  assert.equal(typingClicks.length, 0);
  engine.setSettings({ ...engine.settings, typingFrequency: 1 });
  engine.typing("A", { force: true, localOnly: true });
  assert.equal(typingClicks.length, 1);
  const robotClick = typingClicks[0];
  const system95Blips = [];
  engine.computerBlip = (options) => { system95Blips.push(options); };
  engine.setSettings({ ...engine.settings, soundStyle: "system95" });
  engine.typing("A", { force: true, localOnly: true });
  const system95Blip = system95Blips[0];
  assert(system95Blip);
  assert.notEqual(system95Blip.pitch, robotClick.pitch);
  assert.notEqual(system95Blip.pitch, system95Blip.toPitch);
  assert.equal(system95Blip.destination, engine.typingGain);

  const system95Effects = [];
  engine.system95Sequence = (notes, options) => system95Effects.push({ notes, options });
  engine.success({ localOnly: true });
  engine.error({ localOnly: true });
  engine.impact({ localOnly: true });
  engine.wake({ localOnly: true });
  engine.attention({ localOnly: true });
  engine.setSettings({ ...engine.settings, completeEnabled: true });
  engine.complete({ localOnly: true });
  engine.countdown(0, { localOnly: true });
  engine.gameStart({ localOnly: true });
  assert.deepEqual(system95Effects.map((entry) => entry.options.kind), [
    "success", "error", "impact", "wake", "attention", "complete", "countdown", "game-start"
  ]);

  engine.rouletteTick(2, { localOnly: true });
  assert.equal(system95Blips.at(-1).destination, engine.effectsGain);
  const hangmanTones = [];
  engine.tone = (options) => { hangmanTones.push(options); };
  engine.hangmanPulse(1, { localOnly: true });
  assert.equal(hangmanTones[0].from, 196);
  engine.stopHangmanMusic({ localOnly: true });
  assert.equal([...engine.timers].some((timer) => timer.kind === "hangman-music"), false);

  const relayedCountdowns = [];
  engine.relayEffect = (effect, detail) => {
    if (effect === "countdown") relayedCountdowns.push(detail.value);
    return true;
  };
  engine.countdown(5);
  engine.countdown(0);
  assert.deepEqual(relayedCountdowns, [5, 0]);

  const relayedMessages = [];
  const relaySource = new engineModule.RobotSoundEngine();
  relaySource.relayChannel = { postMessage: (message) => relayedMessages.push(message) };
  relaySource.relaySinks.set("sink-b", Date.now());
  relaySource.relaySinks.set("sink-a", Date.now());
  assert.equal(relaySource.relayEffect("typing", { character: "A" }), true);
  assert.equal(relayedMessages[0].targetSinkId, "sink-a");

  let sinkPlayCount = 0;
  for (const sinkId of ["sink-a", "sink-b"]) {
    const relaySink = new engineModule.RobotSoundEngine();
    relaySink.relaySinkId = sinkId;
    relaySink.relaySinkUsers = 1;
    relaySink.context = { state: "running" };
    relaySink.typing = () => { sinkPlayCount += 1; };
    relaySink.handleRelayMessage(relayedMessages[0]);
  }
  assert.equal(sinkPlayCount, 1);

  let relayedAttentionCount = 0;
  const attentionSink = new engineModule.RobotSoundEngine();
  attentionSink.relaySinkId = "sink-a";
  attentionSink.relaySinkUsers = 1;
  attentionSink.context = { state: "running" };
  attentionSink.attention = () => { relayedAttentionCount += 1; };
  attentionSink.handleRelayMessage({ type: "play", targetSinkId: "sink-a", effect: "attention" });
  assert.equal(relayedAttentionCount, 1);

  let ghostClicks = 0;
  engine.typing = () => { ghostClicks += 1; };
  const activeGlitch = {
    active: true,
    sequence: 1,
    params: { intensity: 0.8 },
    audio: { typingIntensity: 0.8, ghostTyping: true }
  };
  engine.setGlitch(activeGlitch);
  engine.setGlitch(activeGlitch);
  await new Promise((resolve) => setTimeout(resolve, 520));
  assert.equal(ghostClicks, 1);
  engine.stopAll();
  Math.random = originalRandom;
  globalThis.window = originalWindow;

  console.log("robot sound tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
