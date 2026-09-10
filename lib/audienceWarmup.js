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
    surpriseCount: 0,
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

export function audienceWarmupSurpriseProfile(count = 1) {
  const safeCount = Math.max(1, Math.round(Number(count) || 1));
  const pairIndex = Math.floor((safeCount - 1) / 2);
  return {
    count: safeCount,
    pairIndex,
    intensity: pairIndex === 0 ? "light" : pairIndex === 1 ? "medium" : "strange",
    surpriseLevel: Math.max(0, Math.min(5, pairIndex - 1))
  };
}

export function chooseAudienceWarmupSurprisePrompt({ count = 1, excludeId = null, random = Math.random } = {}) {
  const profile = audienceWarmupSurpriseProfile(count);
  if (profile.intensity !== "strange") {
    return chooseAudienceWarmupPrompt({ intensity: profile.intensity, excludeId, random });
  }
  const exact = AUDIENCE_WARMUP_PROMPTS.filter((prompt) => (
    prompt.intensity === "strange"
    && Number(prompt.surpriseLevel || 1) === profile.surpriseLevel
    && prompt.id !== excludeId
  ));
  const available = exact.length ? exact : AUDIENCE_WARMUP_PROMPTS.filter((prompt) => (
    prompt.intensity === "strange"
    && Number(prompt.surpriseLevel || 1) <= profile.surpriseLevel
    && prompt.id !== excludeId
  ));
  return available[Math.floor(random() * available.length)]
    || chooseAudienceWarmupPrompt({ intensity: "strange", excludeId, random });
}

const COUNTDOWN_NUMBER_WORDS = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  catorze: 14,
  quatorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezassete: 17,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20
};

const COUNTDOWN_LABELS = [
  "Zero", "Um", "Dois", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito", "Nove", "Dez",
  "Onze", "Doze", "Treze", "Catorze", "Quinze", "Dezesseis", "Dezessete", "Dezoito", "Dezenove", "Vinte"
];

const COUNTDOWN_NUMBER_PATTERN = `(?:\\d{1,2}|${Object.keys(COUNTDOWN_NUMBER_WORDS).join("|")})`;

function normalizeCountdownText(text) {
  return `${text || ""}`.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function parseCountdownNumber(token) {
  const normalized = normalizeCountdownText(token).trim();
  const number = /^\d{1,2}$/u.test(normalized) ? Number(normalized) : COUNTDOWN_NUMBER_WORDS[normalized];
  return Number.isFinite(number) ? Math.max(1, Math.min(20, number)) : null;
}

function countdownRange(from, to) {
  const safeFrom = Math.max(1, Math.min(20, Number(from) || 1));
  const safeTo = Math.max(1, Math.min(20, Number(to) || 3));
  const step = safeFrom <= safeTo ? 1 : -1;
  const values = [];
  for (let value = safeFrom; step > 0 ? value <= safeTo : value >= safeTo; value += step) values.push(value);
  return { from: safeFrom, to: safeTo, direction: step > 0 ? "ascending" : "descending", values };
}

export function inferAudienceWarmupCountdown(text = "") {
  const normalized = normalizeCountdownText(text);
  if (/\bsem\s+(?:uma\s+)?contagem\b/u.test(normalized)) return null;

  const rangeMatch = normalized.match(new RegExp(`\\b(?:contagem|contar|conte)\\s+(?:regressiva\\s+)?de\\s+(${COUNTDOWN_NUMBER_PATTERN})\\s+(?:ate|a)\\s+(${COUNTDOWN_NUMBER_PATTERN})\\b`, "u"));
  if (rangeMatch) return countdownRange(parseCountdownNumber(rangeMatch[1]), parseCountdownNumber(rangeMatch[2]));

  const descendingMatch = normalized.match(new RegExp(`\\b(?:contagem\\s+regressiva|contar\\s+(?:para\\s+tras|regressivamente))(?:\\s+(?:de|a\\s+partir\\s+de))?\\s+(${COUNTDOWN_NUMBER_PATTERN})\\b`, "u"));
  if (descendingMatch) return countdownRange(parseCountdownNumber(descendingMatch[1]), 1);

  const ascendingPatterns = [
    new RegExp(`\\bquando\\s+(?:eu\\s+)?disser\\s+(${COUNTDOWN_NUMBER_PATTERN})\\b`, "u"),
    new RegExp(`\\b(?:vou|vamos)\\s+contar(?:\\s+ate)?\\s+(${COUNTDOWN_NUMBER_PATTERN})\\b`, "u"),
    new RegExp(`\\b(?:vou|vamos)\\s+fazer\\s+(?:uma\\s+)?contagem(?:\\s+ate)?\\s+(${COUNTDOWN_NUMBER_PATTERN})\\b`, "u"),
    new RegExp(`\\bcontagem\\s+ate\\s+(${COUNTDOWN_NUMBER_PATTERN})\\b`, "u")
  ];
  for (const pattern of ascendingPatterns) {
    const match = normalized.match(pattern);
    if (match) return countdownRange(1, parseCountdownNumber(match[1]));
  }

  if (/\b(?:contagem\s+regressiva|vou\s+contar\s+(?:para\s+tras|regressivamente))\b/u.test(normalized)) return countdownRange(3, 1);
  if (/\b(?:(?:vou|vamos)\s+(?:fazer\s+)?(?:uma\s+)?contagem|(?:vou|vamos)\s+contar|quando\s+(?:eu\s+)?contar|(?:na|minha|essa|esta|uma)\s+contagem)\b/u.test(normalized)) return countdownRange(1, 3);
  return null;
}

export function resolveAudienceWarmupCountdown({ text = "", countdown } = {}) {
  if (countdown === false) return null;
  if (countdown === true) return countdownRange(1, 3);
  if (typeof countdown === "number" && Number.isFinite(countdown)) return countdownRange(1, countdown);
  if (countdown && typeof countdown === "object") {
    if (Array.isArray(countdown.values) && countdown.values.length) {
      const values = countdown.values.map((value) => parseCountdownNumber(value)).filter(Boolean);
      if (values.length) return { from: values[0], to: values.at(-1), direction: values[0] <= values.at(-1) ? "ascending" : "descending", values };
    }
    if (countdown.from !== undefined || countdown.to !== undefined) return countdownRange(countdown.from, countdown.to);
  }
  return inferAudienceWarmupCountdown(text);
}

export function audienceWarmupRequiresCountdown(options = {}) {
  return Boolean(resolveAudienceWarmupCountdown(options));
}

export function createAudienceWarmupSequence({
  text,
  action: actionId,
  countdown,
  promptId = null,
  progressValue,
  repeatableProgress,
  feedbackOverride = null
} = {}) {
  const action = getAudienceWarmupAction(actionId);
  const countdownConfig = resolveAudienceWarmupCountdown({ text, countdown });
  const requiresCountdown = Boolean(countdownConfig);
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
  const countdownSteps = countdownConfig?.values.map((value) => `${COUNTDOWN_LABELS[value]}.`) || [];
  const stepTexts = [text, ...countdownSteps, ...(reactions[action.id] || ["Interessante."])];
  return {
    id: `warmup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: action.label,
    action: action.id,
    progressId: promptId || `manual:${`${text || ""}`.trim().toLocaleLowerCase("pt-BR")}`,
    progressValue: Math.max(0, Math.min(100, Number(progressValue ?? action.progressValue) || 0)),
    repeatableProgress: Boolean(repeatableProgress ?? action.repeatableProgress),
    feedbackOverride: `${feedbackOverride || ""}`.trim() || null,
    requiresCountdown,
    countdown: countdownConfig,
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
