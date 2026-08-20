export const SCENE_AUDIO_EFFECTS_CONTROLLER_ID = "queda-aviao-sampler";

export const SCENE_AUDIO_EFFECT_DEFAULTS = Object.freeze({
  enabled: false,
  preset: "clean",
  drive: 0.35,
  lowCut: 20,
  highCut: 20000,
  echo: 0,
  mix: 0.7,
  output: 1,
  sequence: 0
});

export const SCENE_AUDIO_EFFECT_PRESETS = Object.freeze({
  clean: { enabled: false, drive: 0.2, lowCut: 20, highCut: 20000, echo: 0, mix: 0.7, output: 1 },
  radio: { enabled: true, drive: 0.35, lowCut: 320, highCut: 3600, echo: 0.04, mix: 0.82, output: 0.92 },
  saturado: { enabled: true, drive: 0.7, lowCut: 55, highCut: 11000, echo: 0.08, mix: 0.78, output: 0.82 },
  destruido: { enabled: true, drive: 1, lowCut: 150, highCut: 4800, echo: 0.32, mix: 0.94, output: 0.68 },
  submerso: { enabled: true, drive: 0.42, lowCut: 25, highCut: 1050, echo: 0.2, mix: 0.88, output: 0.86 }
});

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
}

export function normalizeSceneAudioEffects(settings = {}, fallback = SCENE_AUDIO_EFFECT_DEFAULTS) {
  const preset = settings.preset === "custom" || Object.hasOwn(SCENE_AUDIO_EFFECT_PRESETS, settings.preset)
    ? settings.preset
    : (fallback.preset || "clean");

  return {
    enabled: settings.enabled === undefined ? Boolean(fallback.enabled) : Boolean(settings.enabled),
    preset,
    drive: clamp(settings.drive, 0, 1, fallback.drive),
    lowCut: clamp(settings.lowCut, 20, 4000, fallback.lowCut),
    highCut: clamp(settings.highCut, 300, 20000, fallback.highCut),
    echo: clamp(settings.echo, 0, 0.75, fallback.echo),
    mix: clamp(settings.mix, 0, 1, fallback.mix),
    output: clamp(settings.output, 0, 1.25, fallback.output),
    sequence: Math.max(0, Number(settings.sequence ?? fallback.sequence) || 0)
  };
}

export function sceneAudioEffectPreset(name, current = SCENE_AUDIO_EFFECT_DEFAULTS) {
  const preset = Object.hasOwn(SCENE_AUDIO_EFFECT_PRESETS, name) ? name : "clean";
  return normalizeSceneAudioEffects({ ...current, ...SCENE_AUDIO_EFFECT_PRESETS[preset], preset }, current);
}

export function createInitialSceneAudioEffectsState() {
  return {
    [SCENE_AUDIO_EFFECTS_CONTROLLER_ID]: normalizeSceneAudioEffects(SCENE_AUDIO_EFFECT_DEFAULTS)
  };
}

export function publicSceneAudioEffectsSnapshot(state = createInitialSceneAudioEffectsState()) {
  return Object.fromEntries(Object.entries(state).map(([controllerId, settings]) => [
    controllerId,
    normalizeSceneAudioEffects(settings)
  ]));
}
