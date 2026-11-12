export const OPENAI_MODEL_OPTIONS = ["gpt-5.6-terra", "gpt-5.6-luna"];
export const DEFAULT_OPENAI_MODEL = "gpt-5.6-terra";

const LEGACY_OPENAI_MODELS = {
  "gpt-5-mini": "gpt-5.6-terra",
  "gpt-5-mini-2025-08-07": "gpt-5.6-terra",
  "gpt-5-nano": "gpt-5.6-luna",
  "gpt-5-nano-2025-08-07": "gpt-5.6-luna"
};

export function normalizeOpenAIModel(model) {
  const candidate = `${model || ""}`.trim();
  const migrated = Object.hasOwn(LEGACY_OPENAI_MODELS, candidate) ? LEGACY_OPENAI_MODELS[candidate] : candidate;
  return OPENAI_MODEL_OPTIONS.includes(migrated) ? migrated : null;
}

export function resolveOpenAIModel(model, fallback = DEFAULT_OPENAI_MODEL) {
  return normalizeOpenAIModel(model) || normalizeOpenAIModel(fallback) || DEFAULT_OPENAI_MODEL;
}
