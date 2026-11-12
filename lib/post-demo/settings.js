import { normalizePersonality, normalizeExpressionProfile, EXPRESSION_PARAMETERS } from "../operatorPublic.js";
import { DEFAULT_OPENAI_MODEL, resolveOpenAIModel } from "../openaiModels.js";
import { ROBOT_DISPLAY_FONT_NAMES } from "../robot-sound/state.js";

export const POST_DEMO_SETTINGS_VERSION = 2;
export const POST_DEMO_RUNTIME_VERSION = 4;
export const POST_DEMO_CARD_LIMIT = 22;
const clamp = (value, min, max, fallback) => Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;

export function normalizePostDemoConfig(value = {}) {
  // Old settings only had a shared/global cadence: start that migration at a readable pace.
  const migratedHold = value.version === POST_DEMO_SETTINGS_VERSION ? value.cardHoldMs : Math.max(20000, value.cardHoldMs || 20000);
  return { version: POST_DEMO_SETTINGS_VERSION,
    cardHoldMs: clamp(migratedHold, 1000, 120000, 20000),
    typingIntervalMs: clamp(value.typingIntervalMs, 20, 200, 100),
    typingPauseMs: clamp(value.typingPauseMs, 0, 2000, 700),
    displayFont: ROBOT_DISPLAY_FONT_NAMES.includes(value.displayFont) ? value.displayFont : "modern-dos-8x16",
    model: resolveOpenAIModel(value.model, DEFAULT_OPENAI_MODEL),
    personality: normalizePersonality(value.personality),
    profile: { ...Object.fromEntries(EXPRESSION_PARAMETERS.map(({ id }) => [id, 50])), ...normalizeExpressionProfile(value.profile) }
  };
}

export function patchPostDemoConfig(current, patch = {}) {
  const base = normalizePostDemoConfig(current);
  return normalizePostDemoConfig({ ...base, ...patch, version: POST_DEMO_SETTINGS_VERSION,
    personality: { ...base.personality, ...patch.personality }, profile: { ...base.profile, ...patch.profile } });
}

export function postDemoPresentation(value) {
  const { typingIntervalMs, typingPauseMs, displayFont } = normalizePostDemoConfig(value);
  return { typingIntervalMs, typingPauseMs, displayFont };
}
