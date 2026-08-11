export const OPENAI_MODEL_OPTIONS = ["gpt-5-mini", "gpt-5-nano"];
export const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

export function normalizeOpenAIModel(model) {
  const candidate = `${model || ""}`.trim();
  return OPENAI_MODEL_OPTIONS.includes(candidate) ? candidate : null;
}

export function resolveOpenAIModel(model, fallback = DEFAULT_OPENAI_MODEL) {
  return normalizeOpenAIModel(model) || normalizeOpenAIModel(fallback) || DEFAULT_OPENAI_MODEL;
}
