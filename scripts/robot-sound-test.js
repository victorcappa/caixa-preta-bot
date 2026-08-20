const assert = require("node:assert/strict");

async function main() {
  const sound = await import("../lib/robot-sound/state.js");
  const engineModule = await import("../lib/robot-sound/RobotSoundEngine.js");
  const glitch = await import("../lib/glitch/state.js");

  const initial = sound.createInitialRobotSoundState();
  assert.equal(initial.enabled, true);
  assert.equal(initial.preset, "normal");
  assert.equal(initial.typingFrequency, 1);
  assert.equal(initial.outputResetSequence, 0);
  assert(initial.masterVolume > 0 && initial.masterVolume < 0.5);

  const normalized = sound.normalizeRobotSoundSettings({
    enabled: false,
    masterVolume: 4,
    typingVolume: -2,
    typingFrequency: 4,
    outputResetSequence: -4,
    preset: "unknown"
  });
  assert.equal(normalized.enabled, false);
  assert.equal(normalized.masterVolume, 1);
  assert.equal(normalized.typingVolume, 0);
  assert.equal(normalized.typingFrequency, 1);
  assert.equal(normalized.preset, "normal");
  assert.equal(normalized.outputResetSequence, 0);

  assert.equal(sound.normalizeRobotSoundSettings({ typingFrequency: -1 }).typingFrequency, 0);

  assert.equal(sound.classifyRobotSoundCharacter("A"), "key");
  assert.equal(sound.classifyRobotSoundCharacter(" "), "space");
  assert.equal(sound.classifyRobotSoundCharacter(","), "pause");
  assert.equal(sound.classifyRobotSoundCharacter("."), "period");
  assert.equal(sound.classifyRobotSoundCharacter("?"), "emphasis");
  assert.equal(sound.classifyRobotSoundCharacter("\n"), "return");

  assert.deepEqual(sound.ROBOT_SOUND_PRESET_NAMES, ["normal", "seco", "mecanico", "instavel"]);
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
  let typingClicks = 0;
  engine.relayEffect = () => false;
  engine.canPlay = () => true;
  engine.click = () => { typingClicks += 1; };
  engine.setSettings({ ...engine.settings, typingFrequency: 0 });
  engine.typing("A", { force: true, localOnly: true });
  assert.equal(typingClicks, 0);
  engine.setSettings({ ...engine.settings, typingFrequency: 1 });
  engine.typing("A", { force: true, localOnly: true });
  assert.equal(typingClicks, 1);

  const relayedCountdowns = [];
  engine.relayEffect = (effect, detail) => {
    if (effect === "countdown") relayedCountdowns.push(detail.value);
    return true;
  };
  engine.countdown(5);
  engine.countdown(0);
  assert.deepEqual(relayedCountdowns, [5, 0]);
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
