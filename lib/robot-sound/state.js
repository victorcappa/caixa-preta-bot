export const ROBOT_SOUND_PRESETS = {
  normal: {
    pitch: 1180,
    pitchVariation: 0.08,
    durationMs: 24,
    attackMs: 1.2,
    decayMs: 18,
    noise: 0.42,
    filterHz: 3100,
    level: 0.42
  },
  seco: {
    pitch: 1450,
    pitchVariation: 0.05,
    durationMs: 16,
    attackMs: 0.7,
    decayMs: 11,
    noise: 0.28,
    filterHz: 4200,
    level: 0.34
  },
  mecanico: {
    pitch: 860,
    pitchVariation: 0.07,
    durationMs: 31,
    attackMs: 1,
    decayMs: 25,
    noise: 0.58,
    filterHz: 2400,
    level: 0.48
  },
  instavel: {
    pitch: 1060,
    pitchVariation: 0.18,
    durationMs: 28,
    attackMs: 1.5,
    decayMs: 22,
    noise: 0.5,
    filterHz: 2800,
    level: 0.4
  }
};

export const ROBOT_SOUND_PRESET_NAMES = Object.keys(ROBOT_SOUND_PRESETS);

export const ROBOT_SOUND_STYLES = {
  robot: "ROBÔ ATUAL",
  system95: "WINDOWS 95 / 8-BIT"
};

export const ROBOT_SOUND_STYLE_NAMES = Object.keys(ROBOT_SOUND_STYLES);
export const ROBOT_SOUND_STYLE_VERSION = 1;

export const ROBOT_SOUND_DEFAULTS = {
  enabled: true,
  soundStyle: "system95",
  soundStyleVersion: ROBOT_SOUND_STYLE_VERSION,
  masterVolume: 0.32,
  typingVolume: 0.46,
  pitchScale: 1,
  microphoneSensitivity: 1,
  typingFrequency: 0.35,
  typingIntervalMs: 42,
  preset: "normal",
  completeEnabled: false,
  outputResetSequence: 0,
  sequence: 0,
  updatedAt: null
};

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

export function normalizeRobotSoundSettings(settings = {}, base = ROBOT_SOUND_DEFAULTS) {
  const preset = ROBOT_SOUND_PRESET_NAMES.includes(settings.preset)
    ? settings.preset
    : base.preset;
  const soundStyle = Number(settings.soundStyleVersion) === ROBOT_SOUND_STYLE_VERSION
    && ROBOT_SOUND_STYLE_NAMES.includes(settings.soundStyle)
    ? settings.soundStyle
    : ROBOT_SOUND_DEFAULTS.soundStyle;

  return {
    enabled: settings.enabled === undefined ? Boolean(base.enabled) : Boolean(settings.enabled),
    soundStyle,
    soundStyleVersion: ROBOT_SOUND_STYLE_VERSION,
    masterVolume: clampNumber(settings.masterVolume, 0, 1, base.masterVolume),
    typingVolume: clampNumber(settings.typingVolume, 0, 1, base.typingVolume),
    pitchScale: clampNumber(
      settings.pitchScale,
      0.5,
      2,
      base.pitchScale ?? ROBOT_SOUND_DEFAULTS.pitchScale
    ),
    microphoneSensitivity: clampNumber(
      settings.microphoneSensitivity,
      0.25,
      3,
      base.microphoneSensitivity ?? ROBOT_SOUND_DEFAULTS.microphoneSensitivity
    ),
    typingFrequency: clampNumber(
      settings.typingFrequency,
      0,
      1,
      base.typingFrequency ?? ROBOT_SOUND_DEFAULTS.typingFrequency
    ),
    typingIntervalMs: clampNumber(
      settings.typingIntervalMs,
      1000 / 60,
      1000 / 5,
      base.typingIntervalMs ?? ROBOT_SOUND_DEFAULTS.typingIntervalMs
    ),
    preset,
    completeEnabled: settings.completeEnabled === undefined
      ? Boolean(base.completeEnabled)
      : Boolean(settings.completeEnabled),
    outputResetSequence: Math.max(0, Math.round(clampNumber(
      settings.outputResetSequence,
      0,
      Number.MAX_SAFE_INTEGER,
      base.outputResetSequence || 0
    ))),
    sequence: Math.max(0, Math.round(clampNumber(settings.sequence, 0, Number.MAX_SAFE_INTEGER, base.sequence || 0))),
    updatedAt: settings.updatedAt || base.updatedAt || null
  };
}

export function robotTypingIntervalMs(settings = ROBOT_SOUND_DEFAULTS) {
  return clampNumber(
    settings?.typingIntervalMs,
    1000 / 60,
    1000 / 5,
    ROBOT_SOUND_DEFAULTS.typingIntervalMs
  );
}

export function robotMicrophoneSensitivity(settings = ROBOT_SOUND_DEFAULTS) {
  return clampNumber(
    settings?.microphoneSensitivity,
    0.25,
    3,
    ROBOT_SOUND_DEFAULTS.microphoneSensitivity
  );
}

export function createInitialRobotSoundState() {
  return normalizeRobotSoundSettings({
    ...ROBOT_SOUND_DEFAULTS,
    updatedAt: new Date().toISOString()
  });
}

export function publicRobotSoundSnapshot(settings = createInitialRobotSoundState()) {
  return normalizeRobotSoundSettings(settings);
}

export function classifyRobotSoundCharacter(character = "") {
  if (character === "\n" || character === "\r") return "return";
  if (/\s/u.test(character)) return "space";
  if (character === ".") return "period";
  if (character === "," || character === ";" || character === ":") return "pause";
  if (character === "?" || character === "!") return "emphasis";
  return "key";
}
