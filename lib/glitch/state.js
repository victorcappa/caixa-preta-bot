export const GLITCH_VIDEO_ROOT = "videos/glitch";

export const GLITCH_PRESETS = {
  normal: {
    intensity: 0.48,
    rgbSplit: 0.34,
    horizontalShift: 0.32,
    verticalShift: 0.12,
    horizontalTearing: 0.38,
    blockCount: 9,
    blockSize: 0.26,
    frequency: 0.56,
    speed: 0.72,
    flicker: 0.42,
    scanlines: 0.32,
    noise: 0.34,
    distortion: 0.28,
    chromaticAberration: 0.38,
    jitter: 0.46,
    flashChance: 0.22,
    averageDurationMs: 900,
    intervalMs: 380,
    frozenFrames: 1,
    desync: 0.22
  },
  strong: {
    intensity: 0.82,
    rgbSplit: 0.72,
    horizontalShift: 0.74,
    verticalShift: 0.42,
    horizontalTearing: 0.78,
    blockCount: 18,
    blockSize: 0.42,
    frequency: 0.86,
    speed: 1,
    flicker: 0.76,
    scanlines: 0.58,
    noise: 0.72,
    distortion: 0.68,
    chromaticAberration: 0.84,
    jitter: 0.86,
    flashChance: 0.46,
    averageDurationMs: 1450,
    intervalMs: 240,
    frozenFrames: 3,
    desync: 0.64
  },
  continuous: {
    intensity: 0.62,
    rgbSplit: 0.5,
    horizontalShift: 0.52,
    verticalShift: 0.24,
    horizontalTearing: 0.62,
    blockCount: 14,
    blockSize: 0.34,
    frequency: 0.78,
    speed: 0.82,
    flicker: 0.64,
    scanlines: 0.42,
    noise: 0.58,
    distortion: 0.48,
    chromaticAberration: 0.62,
    jitter: 0.66,
    flashChance: 0.3,
    averageDurationMs: 1200,
    intervalMs: 460,
    frozenFrames: 2,
    desync: 0.48
  },
  video: {
    intensity: 0.9,
    rgbSplit: 0.82,
    horizontalShift: 0.86,
    verticalShift: 0.44,
    horizontalTearing: 0.88,
    blockCount: 22,
    blockSize: 0.48,
    frequency: 0.92,
    speed: 1,
    flicker: 0.84,
    scanlines: 0.64,
    noise: 0.78,
    distortion: 0.74,
    chromaticAberration: 0.9,
    jitter: 0.9,
    flashChance: 0.56,
    averageDurationMs: 4200,
    intervalMs: 180,
    frozenFrames: 4,
    desync: 0.74
  }
};

export const GLITCH_DEFAULTS = {
  ...GLITCH_PRESETS.normal
};

export function createInitialGlitchState() {
  return {
    active: false,
    mode: "idle",
    preset: "normal",
    sequence: 0,
    startedAt: null,
    updatedAt: new Date().toISOString(),
    autoStopAt: null,
    params: { ...GLITCH_DEFAULTS },
    video: {
      active: false,
      src: null,
      file: null,
      loop: false,
      takeover: false,
      transitionMs: 5200
    }
  };
}

export function clampNumber(value, min, max, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, number));
}

export function normalizeGlitchParams(params = {}, base = GLITCH_DEFAULTS) {
  return {
    intensity: clampNumber(params.intensity, 0, 1, base.intensity),
    rgbSplit: clampNumber(params.rgbSplit, 0, 1, base.rgbSplit),
    horizontalShift: clampNumber(params.horizontalShift, 0, 1, base.horizontalShift),
    verticalShift: clampNumber(params.verticalShift, 0, 1, base.verticalShift),
    horizontalTearing: clampNumber(params.horizontalTearing, 0, 1, base.horizontalTearing),
    blockCount: Math.round(clampNumber(params.blockCount, 0, 32, base.blockCount)),
    blockSize: clampNumber(params.blockSize, 0, 1, base.blockSize),
    frequency: clampNumber(params.frequency, 0, 1, base.frequency),
    speed: clampNumber(params.speed, 0.05, 2, base.speed),
    flicker: clampNumber(params.flicker, 0, 1, base.flicker),
    scanlines: clampNumber(params.scanlines, 0, 1, base.scanlines),
    noise: clampNumber(params.noise, 0, 1, base.noise),
    distortion: clampNumber(params.distortion, 0, 1, base.distortion),
    chromaticAberration: clampNumber(params.chromaticAberration, 0, 1, base.chromaticAberration),
    jitter: clampNumber(params.jitter, 0, 1, base.jitter),
    flashChance: clampNumber(params.flashChance, 0, 1, base.flashChance),
    averageDurationMs: Math.round(clampNumber(params.averageDurationMs, 80, 12000, base.averageDurationMs)),
    intervalMs: Math.round(clampNumber(params.intervalMs, 40, 6000, base.intervalMs)),
    frozenFrames: Math.round(clampNumber(params.frozenFrames, 0, 12, base.frozenFrames)),
    desync: clampNumber(params.desync, 0, 1, base.desync)
  };
}

export function presetParams(preset = "normal", overrides = {}) {
  const base = GLITCH_PRESETS[preset] || GLITCH_PRESETS.normal;
  return normalizeGlitchParams({ ...base, ...overrides }, base);
}

export function publicGlitchSnapshot(glitch = createInitialGlitchState()) {
  return {
    ...glitch,
    params: normalizeGlitchParams(glitch.params || {}),
    video: { ...(glitch.video || {}) }
  };
}

export function glitchVideoSrc(file) {
  const safeFile = `${file || ""}`.split(/[\\/]/).pop();

  if (!safeFile) {
    return null;
  }

  return `/api/game-assets?file=${encodeURIComponent(`${GLITCH_VIDEO_ROOT}/${safeFile}`)}`;
}
