export const SCENE_AUDIO_EFFECT_DEFAULTS = Object.freeze({
  enabled: false,
  preset: "clean",
  driveEnabled: true,
  drive: 0.35,
  lowCut: 20,
  highCut: 20000,
  phaserEnabled: false,
  phaser: 0.45,
  phaserRate: 0.35,
  wahEnabled: false,
  wah: 0.55,
  wahRate: 0.7,
  echoEnabled: false,
  echo: 0,
  pitchEnabled: false,
  pitch: 0,
  mix: 0.7,
  output: 1
});

export const SCENE_AUDIO_EFFECT_PRESETS = Object.freeze({
  clean: {
    enabled: false,
    driveEnabled: true,
    drive: 0.2,
    lowCut: 20,
    highCut: 20000,
    phaserEnabled: false,
    wahEnabled: false,
    echoEnabled: false,
    echo: 0,
    pitchEnabled: false,
    pitch: 0,
    mix: 0.7,
    output: 1
  },
  radio: {
    enabled: true,
    driveEnabled: true,
    drive: 0.35,
    lowCut: 320,
    highCut: 3600,
    phaserEnabled: false,
    wahEnabled: false,
    echoEnabled: true,
    echo: 0.04,
    pitchEnabled: false,
    pitch: 0,
    mix: 0.82,
    output: 0.92
  },
  saturado: {
    enabled: true,
    driveEnabled: true,
    drive: 0.7,
    lowCut: 55,
    highCut: 11000,
    phaserEnabled: false,
    wahEnabled: false,
    echoEnabled: true,
    echo: 0.08,
    pitchEnabled: false,
    pitch: 0,
    mix: 0.78,
    output: 0.82
  },
  destruido: {
    enabled: true,
    driveEnabled: true,
    drive: 1,
    lowCut: 150,
    highCut: 4800,
    phaserEnabled: true,
    phaser: 0.72,
    phaserRate: 0.48,
    wahEnabled: false,
    echoEnabled: true,
    echo: 0.32,
    pitchEnabled: true,
    pitch: -3,
    mix: 0.94,
    output: 0.68
  },
  submerso: {
    enabled: true,
    driveEnabled: true,
    drive: 0.42,
    lowCut: 25,
    highCut: 1050,
    phaserEnabled: true,
    phaser: 0.58,
    phaserRate: 0.18,
    wahEnabled: true,
    wah: 0.32,
    wahRate: 0.24,
    echoEnabled: true,
    echo: 0.2,
    pitchEnabled: true,
    pitch: -5,
    mix: 0.88,
    output: 0.86
  }
});

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
}

function booleanSetting(settings, key, fallback) {
  return settings[key] === undefined ? Boolean(fallback[key]) : Boolean(settings[key]);
}

export function normalizeSceneAudioEffects(settings = {}, fallback = SCENE_AUDIO_EFFECT_DEFAULTS) {
  const preset = settings.preset === "custom" || Object.hasOwn(SCENE_AUDIO_EFFECT_PRESETS, settings.preset)
    ? settings.preset
    : (fallback.preset || "clean");

  return {
    enabled: booleanSetting(settings, "enabled", fallback),
    preset,
    driveEnabled: booleanSetting(settings, "driveEnabled", fallback),
    drive: clamp(settings.drive, 0, 1, fallback.drive),
    lowCut: clamp(settings.lowCut, 20, 4000, fallback.lowCut),
    highCut: clamp(settings.highCut, 300, 20000, fallback.highCut),
    phaserEnabled: booleanSetting(settings, "phaserEnabled", fallback),
    phaser: clamp(settings.phaser, 0, 1, fallback.phaser),
    phaserRate: clamp(settings.phaserRate, 0.05, 8, fallback.phaserRate),
    wahEnabled: booleanSetting(settings, "wahEnabled", fallback),
    wah: clamp(settings.wah, 0, 1, fallback.wah),
    wahRate: clamp(settings.wahRate, 0.05, 8, fallback.wahRate),
    echoEnabled: booleanSetting(settings, "echoEnabled", fallback),
    echo: clamp(settings.echo, 0, 0.75, fallback.echo),
    pitchEnabled: booleanSetting(settings, "pitchEnabled", fallback),
    pitch: clamp(settings.pitch, -12, 12, fallback.pitch),
    mix: clamp(settings.mix, 0, 1, fallback.mix),
    output: clamp(settings.output, 0, 1.25, fallback.output)
  };
}

export function sceneAudioEffectPreset(name, current = SCENE_AUDIO_EFFECT_DEFAULTS) {
  const preset = Object.hasOwn(SCENE_AUDIO_EFFECT_PRESETS, name) ? name : "clean";
  return normalizeSceneAudioEffects({ ...current, ...SCENE_AUDIO_EFFECT_PRESETS[preset], preset }, current);
}
