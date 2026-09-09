import { AUDIENCE_WARMUP_ACTIONS, AUDIENCE_WARMUP_PROMPTS } from "../data/audience-warmup-prompts.js";

export const AUDIENCE_WARMUP_INTERVAL_MIN = 800;
export const AUDIENCE_WARMUP_INTERVAL_MAX = 15000;

export function createInitialAudienceWarmupState() {
  return {
    active: false,
    selectedAction: "clap",
    intensity: "light",
    preview: "",
    previewPromptId: null,
    sequence: null,
    currentStep: -1,
    awaitingOperator: false,
    automatic: false,
    intervalMs: 2500,
    display: null,
    history: [],
    updatedAt: new Date().toISOString()
  };
}

export function getAudienceWarmupAction(actionId) {
  return AUDIENCE_WARMUP_ACTIONS.find((action) => action.id === actionId) || AUDIENCE_WARMUP_ACTIONS[0];
}

export function chooseAudienceWarmupPrompt({ action, intensity, excludeId = null, random = Math.random } = {}) {
  let options = AUDIENCE_WARMUP_PROMPTS.filter((prompt) => (
    (!action || prompt.action === action) && (!intensity || prompt.intensity === intensity) && prompt.id !== excludeId
  ));
  if (!options.length) options = AUDIENCE_WARMUP_PROMPTS.filter((prompt) => !action || prompt.action === action);
  if (!options.length) options = AUDIENCE_WARMUP_PROMPTS;
  return options[Math.floor(random() * options.length)] || null;
}

export function audienceWarmupRequiresCountdown({ text = "", countdown } = {}) {
  if (typeof countdown === "boolean") return countdown;
  return /\bquando\s+eu\s+disser\s+(?:tr[eê]s|3)\b/iu.test(`${text}`);
}

export function createAudienceWarmupSequence({ text, action: actionId, countdown } = {}) {
  const action = getAudienceWarmupAction(actionId);
  const requiresCountdown = audienceWarmupRequiresCountdown({ text, countdown });
  const reactions = {
    clap: ["Escutem o tamanho dessa resposta.", "Interessante."],
    hand: ["Hm. Estou contando.", "Podem abaixar."],
    hands: ["Isso muda bastante a imagem da sala.", "Podem abaixar."],
    feet: ["Eu senti daqui.", "Certo."],
    word: ["Muitas respostas. Uma sala."],
    sound: ["Respirem.", "Agora.", "A sala também tem voz."],
    silence: ["Fiquem assim.", "O silêncio também respondeu."],
    look: ["Sustentem por um instante.", "Certo. Já podem voltar para mim."]
  };
  const countdownSteps = requiresCountdown ? ["Um.", "Dois.", "Três."] : [];
  const stepTexts = [text, ...countdownSteps, ...(reactions[action.id] || ["Interessante."])];
  return {
    id: `warmup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: action.label,
    action: action.id,
    requiresCountdown,
    steps: stepTexts.map((stepText, index) => ({
      id: `${action.id}-${index}`,
      text: stepText,
      kind: index === 0 ? "instruction" : index <= countdownSteps.length ? "count" : "reaction"
    }))
  };
}

export function clampAudienceWarmupInterval(value) {
  return Math.max(AUDIENCE_WARMUP_INTERVAL_MIN, Math.min(AUDIENCE_WARMUP_INTERVAL_MAX, Number(value) || 2500));
}

export function publicAudienceWarmupSnapshot(state = createInitialAudienceWarmupState()) {
  return {
    ...state,
    history: [...(state.history || [])].slice(-40),
    sequence: state.sequence ? { ...state.sequence, steps: state.sequence.steps.map((step) => ({ ...step })) } : null,
    display: state.display ? { ...state.display } : null
  };
}
