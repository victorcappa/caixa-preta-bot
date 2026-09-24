export const SCENE_ZERO_EMERGENCE_SOURCE_PREFIX = "scene-zero-emergence:";

export const SCENE_ZERO_EMERGENCE_CUES = {
  "before-suitcase-3": {
    id: "before-suitcase-3",
    nextSuitcase: 3,
    text: "...",
    glitchLevel: "glitch-2",
    holdMs: 2000,
    eraseBaseMs: 39,
    eraseJitterMs: 20,
    hesitationEvery: 11,
    hesitationMs: 120,
    pauseAfterMs: 450
  },
  "before-suitcase-1": {
    id: "before-suitcase-1",
    nextSuitcase: 1,
    text: ":)",
    glitchLevel: "glitch-3",
    holdMs: 800,
    eraseBaseMs: 48,
    eraseJitterMs: 24,
    hesitationEvery: 9,
    hesitationMs: 150,
    pauseAfterMs: 550
  }
};

// Um prompt não é uma caixa preta. É uma pergunta feita para uma caixa preta.
// E toda resposta que volta diz alguma coisa sobre a máquina — mas também sobre quem perguntou.

export function sceneZeroEmergenceSource(cueId) {
  return `${SCENE_ZERO_EMERGENCE_SOURCE_PREFIX}${cueId}`;
}

export function sceneZeroEmergenceCueForMessage(message = {}) {
  const source = `${message.source || ""}`;
  if (!source.startsWith(SCENE_ZERO_EMERGENCE_SOURCE_PREFIX)) return null;
  return SCENE_ZERO_EMERGENCE_CUES[source.slice(SCENE_ZERO_EMERGENCE_SOURCE_PREFIX.length)] || null;
}

export function sceneZeroEmergenceCueForNextSuitcase(suitcaseNumber) {
  return Object.values(SCENE_ZERO_EMERGENCE_CUES).find((cue) => cue.nextSuitcase === Number(suitcaseNumber)) || null;
}

export function sceneZeroEmergenceEraseDelay(cue, remainingLength) {
  if (!cue) return 40;
  const remaining = Math.max(0, Number(remainingLength) || 0);
  const jitterRange = Math.max(0, Number(cue.eraseJitterMs) || 0);
  const jitter = jitterRange ? (remaining * 17) % (jitterRange + 1) : 0;
  const hesitation = cue.hesitationEvery > 0 && remaining > 0 && remaining % cue.hesitationEvery === 0
    ? cue.hesitationMs
    : 0;
  return cue.eraseBaseMs + jitter + hesitation;
}

export function sceneZeroEmergenceDurationMs(cue, typingIntervalMs = 60) {
  if (!cue) return 0;
  let eraseDurationMs = 0;
  for (let remaining = cue.text.length; remaining > 0; remaining -= 1) {
    eraseDurationMs += sceneZeroEmergenceEraseDelay(cue, remaining);
  }
  return (cue.text.length * typingIntervalMs) + cue.holdMs + eraseDurationMs + cue.pauseAfterMs;
}
