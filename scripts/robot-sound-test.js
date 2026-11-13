const assert = require("node:assert/strict");

async function main() {
  const sound = await import("../lib/robot-sound/state.js");
  const engineModule = await import("../lib/robot-sound/RobotSoundEngine.js");
  const shared = engineModule.robotSoundEngine, sharedSettings = shared.settings;
  const contextBefore = shared.context, outputMarker = { state: "running" };
  shared.context = outputMarker; shared.typing = () => {}; shared.handleRelayMessage = () => {};
  const refreshedEngine = await import("../lib/robot-sound/RobotSoundEngine.js?typing-volume-refresh");
  assert.equal(refreshedEngine.robotSoundEngine, shared, "sound refresh preserves the existing output instance");
  assert.equal(shared.context, outputMarker); assert.equal(shared.settings, sharedSettings);
  assert.equal(shared.typing, refreshedEngine.RobotSoundEngine.prototype.typing);
  assert.equal(shared.handleRelayMessage, refreshedEngine.RobotSoundEngine.prototype.handleRelayMessage);
  shared.context = contextBefore;
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
  assert.equal(initial.typingPauseMs, 0);
  assert.equal(initial.messageGapMs, 0);
  assert.equal(sound.normalizeRobotSoundSettings({ typingPauseMs: 5000, messageGapMs: 20000 }).typingPauseMs, 2000);
  assert.equal(sound.normalizeRobotSoundSettings({ typingPauseMs: 5000, messageGapMs: 20000 }).messageGapMs, 10000);
  const timing = { typingIntervalMs: 50, typingPauseMs: 300, messageGapMs: 700 };
  assert.equal(sound.robotTypingDelayMs(timing, "A"), 50);
  assert.equal(sound.robotTypingDelayMs(timing, ","), 350);
  assert.equal(sound.robotTypingDelayMs(timing, "\n"), 350);
  assert.equal(sound.robotTypingDurationMs("A,B.", timing), 500, "pause after comma, without trailing punctuation pause");
  assert.equal(sound.robotMessageReadingMs("A,B.", timing), 1200, "reading schedule includes configured gap");
  assert.equal(initial.displayFont, "modern-dos-8x16");
  assert.deepEqual(sound.ROBOT_DISPLAY_FONT_NAMES, ["modern-dos-8x16", "modern-dos-9x16", "vt323", "courier"]);
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
  assert.equal(sound.normalizeRobotSoundSettings({ displayFont: "modern-dos-9x16" }).displayFont, "modern-dos-9x16");
  assert.equal(sound.normalizeRobotSoundSettings({ displayFont: "vt323" }).displayFont, "vt323");
  assert.equal(sound.normalizeRobotSoundSettings({ displayFont: "unknown" }).displayFont, "modern-dos-8x16");
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

  function typingFixture(soundStyle) {
    const instance = new engineModule.RobotSoundEngine();
    const voices = [];
    instance.setSettings({ ...instance.settings, soundStyle, soundStyleVersion: sound.ROBOT_SOUND_STYLE_VERSION, typingFrequency: 1 });
    const savedSettings = { ...instance.settings };
    Object.freeze(instance.settings);
    instance.canPlay = () => true;
    instance.typingGain = { id: "fixture-typing-gain" };
    instance.click = instance.computerBlip = (options) => voices.push(options);
    instance.masterGain = { gain: { setTargetAtTime() { assert.fail("typing não deve alterar o ganho mestre"); } } };
    instance.setSettings = () => assert.fail("o volume de uma fala não deve virar uma preferência salva");
    return { instance, voices, savedSettings };
  }

  for (const style of ["robot", "system95"]) {
    const { instance, voices, savedSettings } = typingFixture(style);
    instance.typing("A", { force: true, localOnly: true });
    const fullLevel = voices.at(-1).level;
    instance.typing("A", { force: true, localOnly: true, volumeScale: .25 });
    assert.equal(voices.at(-1).level, fullLevel * .25, `${style}: escala apenas o nível desta voz`);
    for (const volumeScale of [2, NaN, Infinity]) {
      instance.typing("A", { force: true, localOnly: true, volumeScale });
      assert.equal(voices.at(-1).level, fullLevel, `${style}: limita valores altos e usa 1 para não finitos`);
    }
    const beforeMute = voices.length;
    let gateCalls = 0, relayCalls = 0;
    instance.canPlay = () => { gateCalls += 1; return true; };
    instance.relayEffect = () => { relayCalls += 1; return false; };
    instance.typing("A", { force: true, volumeScale: 0 });
    instance.typing("A", { force: true, volumeScale: -1 });
    assert.equal(voices.length, beforeMute);
    assert.equal(gateCalls, 0, `${style}: mudo não chega a criar vozes`);
    assert.equal(relayCalls, 0, `${style}: mudo não envia eventos de áudio`);
    instance.canPlay = () => false;
    instance.typing("A", { force: true, localOnly: true, volumeScale: .25 });
    assert.equal(voices.length, beforeMute, `${style}: preserva o bloqueio local canPlay`);
    assert.deepEqual(instance.settings, savedSettings);

    const glitchFixture = typingFixture(style), scheduled = [];
    glitchFixture.instance.glitch = { active: true, intensity: 1 };
    glitchFixture.instance.scheduleTimer = (callback, delay, kind) => scheduled.push({ callback, delay, kind });
    glitchFixture.instance.relayEffect = () => assert.fail("repetição recebida pelo sink deve permanecer local");
    Math.random = () => .15;
    glitchFixture.instance.typing("A", { force: true, localOnly: true, volumeScale: .25 });
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].kind, "glitch");
    scheduled[0].callback();
    assert.equal(glitchFixture.voices.length, 2);
    assert.equal(glitchFixture.voices[1].level, glitchFixture.voices[0].level, `${style}: repetição glitch preserva a escala`);
    assert.deepEqual(glitchFixture.instance.settings, glitchFixture.savedSettings);
    Math.random = () => 0;
  }

  const scaledRelayMessages = [];
  const scaledRelaySource = new engineModule.RobotSoundEngine();
  scaledRelaySource.relayChannel = { postMessage: (message) => scaledRelayMessages.push(message) };
  scaledRelaySource.relaySinks.set("scaled-sink", Date.now());
  scaledRelaySource.canPlay = () => false;
  scaledRelaySource.click = scaledRelaySource.computerBlip = () => assert.fail("a origem não deve tocar áudio encaminhado");
  const sourceSettings = { ...scaledRelaySource.settings };
  scaledRelaySource.typing("A", { force: true, volumeScale: .25 });
  scaledRelaySource.typing("A", { force: true, volumeScale: 0 });
  assert.equal(scaledRelayMessages.length, 1, "encaminha uma vez e suprime a fala muda mesmo sem áudio local");
  assert.equal(scaledRelayMessages[0].volumeScale, .25);
  assert.equal(scaledRelayMessages[0].force, true);
  assert.deepEqual(scaledRelaySource.settings, sourceSettings);
  const { instance: scaledSink, voices: scaledSinkVoices, savedSettings: sinkSettings } = typingFixture("system95");
  scaledSink.relaySinkId = "scaled-sink";
  scaledSink.relaySinkUsers = 1;
  scaledSink.context = { state: "running" };
  scaledSink.relayEffect = () => assert.fail("o sink não deve reenviar a digitação recebida");
  scaledSink.typing("A", { force: true, localOnly: true });
  const sinkFullLevel = scaledSinkVoices[0].level;
  scaledSink.handleRelayMessage(scaledRelayMessages[0]);
  assert.equal(scaledSinkVoices.length, 2);
  assert.equal(scaledSinkVoices[1].level, sinkFullLevel * .25, "o sink aplica a escala recebida uma única vez");
  assert.deepEqual(scaledSink.settings, sinkSettings);

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
  engine.gameOver({ localOnly: true });
  engine.whistle({ localOnly: true });
  assert.deepEqual(system95Effects.map((entry) => entry.options.kind), [
    "success", "error", "impact", "wake", "attention", "complete", "countdown", "game-start", "game-over", "whistle"
  ]);
  await new Promise((resolve) => setTimeout(resolve, 550));
  assert.equal(
    system95Effects.filter((entry) => entry.options.kind === "attention").length,
    2,
    "cada chamada de atenção deve tocar a frase sonora duas vezes"
  );

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

  let relayedWhistleCount = 0;
  const whistleSink = new engineModule.RobotSoundEngine();
  whistleSink.relaySinkId = "sink-a";
  whistleSink.relaySinkUsers = 1;
  whistleSink.context = { state: "running" };
  whistleSink.whistle = () => { relayedWhistleCount += 1; };
  whistleSink.handleRelayMessage({ type: "play", targetSinkId: "sink-a", effect: "whistle" });
  assert.equal(relayedWhistleCount, 1);

  let relayedGameOverCount = 0;
  const gameOverSink = new engineModule.RobotSoundEngine();
  gameOverSink.relaySinkId = "sink-a";
  gameOverSink.relaySinkUsers = 1;
  gameOverSink.context = { state: "running" };
  gameOverSink.gameOver = () => { relayedGameOverCount += 1; };
  gameOverSink.handleRelayMessage({ type: "play", targetSinkId: "sink-a", effect: "game-over" });
  assert.equal(relayedGameOverCount, 1);

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
