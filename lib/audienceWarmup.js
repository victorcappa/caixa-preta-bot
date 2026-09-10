import { AUDIENCE_WARMUP_ACTIONS, AUDIENCE_WARMUP_PROMPTS } from "../data/audience-warmup-prompts.js";
import {
  AUDIENCE_WARMUP_MINIGAME_COUNTDOWN_SECONDS,
  AUDIENCE_WARMUP_MINIGAMES,
  getAudienceWarmupMinigame
} from "../data/audience-warmup-minigames.js";

export const AUDIENCE_WARMUP_INTERVAL_MIN = 800;
export const AUDIENCE_WARMUP_INTERVAL_MAX = 15000;
export const AUDIENCE_WARMUP_SURPRISE_STAGES = ["play", "personal", "exposed", "provocative", "social_pressure"];

export const AUDIENCE_WARMUP_FORBIDDEN_LANGUAGE = /\b(?:por favor|se vocês puderem|se voces puderem|gostaria que|vamos tentar|poderiam|vocês conseguem|voces conseguem|se quiserem|vamos fazer|que tal)\b/iu;

export function createInitialAudienceWarmupMinigameState(now = new Date().toISOString()) {
  return {
    status: "idle",
    selectedId: null,
    selectionMode: null,
    drawStartedAt: null,
    drawEndsAt: null,
    revealedAt: null,
    round: 0,
    timer: {
      status: "idle",
      phase: null,
      durationSeconds: 0,
      remainingSeconds: 0,
      endsAt: null,
      sequence: 0
    },
    durations: Object.fromEntries(AUDIENCE_WARMUP_MINIGAMES.map((game) => [game.id, game.defaultDurationSeconds])),
    swapSeconds: getAudienceWarmupMinigame("tapao").defaultSwapSeconds,
    completedAt: null,
    skipped: false,
    updatedAt: now
  };
}

export function createInitialAudienceWarmupState() {
  return {
    active: false,
    phase: "idle",
    selectedAction: "stomp",
    intensity: "play",
    preview: "",
    previewPromptId: null,
    sequence: null,
    currentStep: -1,
    awaitingOperator: false,
    automatic: false,
    intervalMs: 2500,
    display: null,
    actionTimer: null,
    surpriseCount: 0,
    recentPromptIds: [],
    minigame: createInitialAudienceWarmupMinigameState(),
    history: [],
    updatedAt: new Date().toISOString()
  };
}

export function audienceWarmupHasForbiddenLanguage(text = "") {
  return AUDIENCE_WARMUP_FORBIDDEN_LANGUAGE.test(`${text || ""}`);
}

export function clampAudienceWarmupMinigameDuration(value) {
  return Math.max(5, Math.min(300, Math.round(Number(value) || 5)));
}

export function audienceWarmupTimerRemaining(timer, now = Date.now()) {
  if (timer?.status === "running" && timer.endsAt) {
    return Math.max(0, Math.ceil((Date.parse(timer.endsAt) - Number(now)) / 1000));
  }
  return Math.max(0, Math.round(Number(timer?.remainingSeconds) || 0));
}

export function selectAudienceWarmupMinigame(state, gameId, { mode = "manual", now = new Date().toISOString() } = {}) {
  const game = getAudienceWarmupMinigame(gameId);
  if (!game) return { state, applied: false, reason: "MINIGAME_NOT_FOUND" };
  if (["countdown", "running", "paused", "exchange", "ready_round_two", "completed"].includes(state.status)) {
    return { state, applied: false, reason: "MINIGAME_ALREADY_STARTED" };
  }
  return {
    applied: true,
    game,
    state: {
      ...state,
      status: "selected",
      selectedId: game.id,
      selectionMode: mode,
      drawStartedAt: null,
      drawEndsAt: null,
      revealedAt: now,
      round: 0,
      timer: { ...state.timer, status: "idle", phase: null, durationSeconds: 0, remainingSeconds: 0, endsAt: null },
      completedAt: null,
      skipped: false,
      updatedAt: now
    }
  };
}

export function startAudienceWarmupMinigameCountdown(state, now = new Date().toISOString()) {
  const game = getAudienceWarmupMinigame(state.selectedId);
  if (!game || !["ready", "ready_round_two"].includes(state.status)) return { state, applied: false, reason: "MINIGAME_NOT_READY" };
  const round = state.status === "ready_round_two" ? 2 : Math.max(1, Number(state.round) || 1);
  return {
    applied: true,
    state: {
      ...state,
      status: "countdown",
      round,
      timer: {
        status: "running",
        phase: "countdown",
        durationSeconds: AUDIENCE_WARMUP_MINIGAME_COUNTDOWN_SECONDS,
        remainingSeconds: AUDIENCE_WARMUP_MINIGAME_COUNTDOWN_SECONDS,
        endsAt: new Date(Date.parse(now) + AUDIENCE_WARMUP_MINIGAME_COUNTDOWN_SECONDS * 1000).toISOString(),
        sequence: Number(state.timer?.sequence || 0) + 1
      },
      updatedAt: now
    }
  };
}

export function beginAudienceWarmupMinigameRound(state, now = new Date().toISOString()) {
  const game = getAudienceWarmupMinigame(state.selectedId);
  if (!game || state.status !== "countdown") return { state, applied: false, reason: "MINIGAME_COUNTDOWN_NOT_RUNNING" };
  const durationSeconds = game.id === "tapao"
    ? game.defaultDurationSeconds
    : clampAudienceWarmupMinigameDuration(state.durations?.[game.id] || game.defaultDurationSeconds);
  return {
    applied: true,
    state: {
      ...state,
      status: "running",
      timer: {
        status: "running",
        phase: state.round === 2 ? "round_two" : "round_one",
        durationSeconds,
        remainingSeconds: durationSeconds,
        endsAt: new Date(Date.parse(now) + durationSeconds * 1000).toISOString(),
        sequence: Number(state.timer?.sequence || 0) + 1
      },
      updatedAt: now
    }
  };
}

export function pauseAudienceWarmupMinigame(state, now = new Date().toISOString()) {
  if (state.status !== "running" || state.timer?.status !== "running") return { state, applied: false, reason: "MINIGAME_NOT_RUNNING" };
  const remainingSeconds = audienceWarmupTimerRemaining(state.timer, Date.parse(now));
  return {
    applied: true,
    state: {
      ...state,
      status: "paused",
      timer: { ...state.timer, status: "paused", remainingSeconds, endsAt: null },
      updatedAt: now
    }
  };
}

export function resumeAudienceWarmupMinigame(state, now = new Date().toISOString()) {
  if (state.status !== "paused" || state.timer?.status !== "paused") return { state, applied: false, reason: "MINIGAME_NOT_PAUSED" };
  const remainingSeconds = Math.max(1, Number(state.timer.remainingSeconds) || 1);
  return {
    applied: true,
    state: {
      ...state,
      status: "running",
      timer: { ...state.timer, status: "running", remainingSeconds, endsAt: new Date(Date.parse(now) + remainingSeconds * 1000).toISOString() },
      updatedAt: now
    }
  };
}

export function adjustAudienceWarmupMinigameTime(state, deltaSeconds, now = new Date().toISOString()) {
  if (!["running", "paused"].includes(state.status)) return { state, applied: false, reason: "MINIGAME_TIMER_NOT_ADJUSTABLE" };
  const remainingSeconds = Math.max(1, audienceWarmupTimerRemaining(state.timer, Date.parse(now)) + Math.round(Number(deltaSeconds) || 0));
  return {
    applied: true,
    state: {
      ...state,
      timer: {
        ...state.timer,
        remainingSeconds,
        endsAt: state.status === "running" ? new Date(Date.parse(now) + remainingSeconds * 1000).toISOString() : null,
        sequence: Number(state.timer?.sequence || 0) + 1
      },
      updatedAt: now
    }
  };
}

export function getAudienceWarmupAction(actionId) {
  return AUDIENCE_WARMUP_ACTIONS.find((action) => action.id === actionId) || AUDIENCE_WARMUP_ACTIONS[0];
}

function resolveRecentPrompts(recentPromptIds = []) {
  return recentPromptIds
    .map((entry) => typeof entry === "string" ? AUDIENCE_WARMUP_PROMPTS.find((prompt) => prompt.id === entry) : entry)
    .filter(Boolean)
    .slice(-8);
}

export function audienceWarmupPromptDiversityScore(prompt, recentPromptIds = []) {
  const recent = resolveRecentPrompts(recentPromptIds);
  let score = 100;
  recent.forEach((previous, reverseIndex) => {
    const distance = recent.length - reverseIndex;
    const weight = Math.max(1, 7 - distance);
    if (prompt.id === previous.id) score -= 1000;
    if (prompt.action === previous.action) score -= 38 * weight;
    if (prompt.interactionType === previous.interactionType) score -= 34 * weight;
    if (prompt.category === previous.category) score -= 24 * weight;
    const sharedTags = prompt.tags.filter((tag) => previous.tags.includes(tag)).length;
    score -= sharedTags * 18 * weight;
    const promptOpening = prompt.text.split(/\s+/u).slice(0, 2).join(" ");
    const previousOpening = previous.text.split(/\s+/u).slice(0, 2).join(" ");
    if (promptOpening === previousOpening) score -= 20 * weight;
  });
  return score;
}

export function chooseAudienceWarmupPrompt({ action, intensity, excludeId = null, recentPromptIds = [], random = Math.random } = {}) {
  let options = AUDIENCE_WARMUP_PROMPTS.filter((prompt) => (
    (!action || prompt.action === action) && (!intensity || prompt.intensity === intensity) && prompt.id !== excludeId
  ));
  if (!options.length) options = AUDIENCE_WARMUP_PROMPTS.filter((prompt) => (
    (!intensity || prompt.intensity === intensity) && prompt.id !== excludeId
  ));
  if (!options.length) options = AUDIENCE_WARMUP_PROMPTS.filter((prompt) => prompt.id !== excludeId);
  if (!options.length) options = AUDIENCE_WARMUP_PROMPTS;
  const recentPrompts = resolveRecentPrompts(recentPromptIds);
  const recentIds = new Set(recentPrompts.map((prompt) => prompt.id));
  const unseenOptions = options.filter((prompt) => !recentIds.has(prompt.id));
  if (unseenOptions.length) options = unseenOptions;
  const lastPrompt = recentPrompts.at(-1);
  if (lastPrompt) {
    const avoidsImmediateRepetition = options.filter((prompt) => (
      prompt.action !== lastPrompt.action
      && prompt.interactionType !== lastPrompt.interactionType
      && prompt.category !== lastPrompt.category
    ));
    const avoidsImmediateSubject = avoidsImmediateRepetition.filter((prompt) => (
      !prompt.tags.some((tag) => lastPrompt.tags.includes(tag))
    ));
    if (avoidsImmediateSubject.length) options = avoidsImmediateSubject;
    else if (avoidsImmediateRepetition.length) options = avoidsImmediateRepetition;
  }
  const ranked = options
    .map((prompt) => ({ prompt, score: audienceWarmupPromptDiversityScore(prompt, recentPromptIds) + random() }))
    .sort((a, b) => b.score - a.score);
  const bestScore = ranked[0]?.score ?? 0;
  const finalists = ranked.filter((entry) => entry.score >= bestScore - 0.999);
  return finalists[Math.floor(random() * finalists.length)]?.prompt || ranked[0]?.prompt || null;
}

export function audienceWarmupSurpriseProfile(count = 1) {
  const safeCount = Math.max(1, Math.round(Number(count) || 1));
  const stageIndex = Math.floor((safeCount - 1) / 6);
  const surpriseLevel = Math.min(AUDIENCE_WARMUP_SURPRISE_STAGES.length - 1, stageIndex);
  return {
    count: safeCount,
    stageIndex,
    stage: AUDIENCE_WARMUP_SURPRISE_STAGES[surpriseLevel],
    intensity: AUDIENCE_WARMUP_SURPRISE_STAGES[surpriseLevel],
    surpriseLevel
  };
}

export function chooseAudienceWarmupSurprisePrompt({ count = 1, excludeId = null, recentPromptIds = [], random = Math.random } = {}) {
  const profile = audienceWarmupSurpriseProfile(count);
  return chooseAudienceWarmupPrompt({
    intensity: profile.intensity,
    excludeId,
    recentPromptIds,
    random
  });
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

  const durationMatch = normalized.match(new RegExp(`\\b(?:por|durante|em|mais)\\s+(${COUNTDOWN_NUMBER_PATTERN})\\s+segundos?\\b`, "u"));
  if (durationMatch) return countdownRange(parseCountdownNumber(durationMatch[1]), 1);

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

export function audienceWarmupAutoAdvanceDelay({
  sequence,
  stepIndex,
  intervalMs = 2500,
  typingIntervalMs = 22
} = {}) {
  const step = sequence?.steps?.[stepIndex];
  const safeInterval = clampAudienceWarmupInterval(intervalMs);
  if (Number.isFinite(step?.delayMs)) return clampAudienceWarmupInterval(step.delayMs);
  const durationSeconds = Number(step?.durationSeconds ?? (stepIndex === 0 ? sequence?.durationSeconds : 0));
  if (durationSeconds > 0) return Math.max(1000, Math.min(30000, durationSeconds * 1000));
  if (step?.kind === "count") return 1000;
  if (sequence?.requiresCountdown && stepIndex === 0) {
    return Math.max(safeInterval, `${step?.text || ""}`.length * typingIntervalMs + 700);
  }
  return safeInterval;
}

export function createAudienceWarmupSequence({
  text,
  action: actionId,
  countdown,
  promptId = null,
  category = null,
  intensity = null,
  interactionType = null,
  tags = [],
  durationSeconds = null,
  progressValue,
  repeatableProgress,
  feedbackOverride = null,
  steps: authoredSteps = null,
  reaction = true
} = {}) {
  const action = getAudienceWarmupAction(actionId);
  const countdownConfig = resolveAudienceWarmupCountdown({ text, countdown });
  const requiresCountdown = Boolean(countdownConfig);
  const reactions = {
    clap: ["RESPOSTA SONORA REGISTRADA."],
    hand: ["EXPOSIÇÃO REGISTRADA.", "ABAIXEM."],
    hands: ["EXPOSIÇÃO AMPLIADA.", "ABAIXEM."],
    feet: ["IMPACTO REGISTRADO."],
    word: ["DADOS INCOMPATÍVEIS. ACEITOS."],
    sound: ["RUÍDO COLETIVO REGISTRADO."],
    silence: ["SILÊNCIO COMPUTADO."],
    look: ["VÍNCULO VISUAL REGISTRADO."],
    stand: ["CORPOS CONTABILIZADOS."],
    sit: ["POSIÇÃO RESTAURADA."],
    point: ["JULGAMENTO REGISTRADO."],
    snap: ["IMPULSO REGISTRADO."],
    lean: ["DESLOCAMENTO MÍNIMO REGISTRADO."],
    turn: ["CAMPO VISUAL ALTERADO."],
    eyes: ["VISÃO INTERROMPIDA."],
    laugh: ["RISO REGISTRADO."],
    gesture: ["GESTO REGISTRADO."],
    move: ["DISTRIBUIÇÃO ALTERADA."],
    group: ["GRUPOS FORMADOS. OBSERVEM A DISTRIBUIÇÃO."],
    touch: ["CONTATO REGISTRADO. SEPAREM-SE."]
  };
  const countdownSteps = countdownConfig?.values.map((value) => `${COUNTDOWN_LABELS[value]}.`) || [];
  const normalizedAuthoredSteps = Array.isArray(authoredSteps)
    ? authoredSteps.map((step, index) => {
      const source = typeof step === "string" ? { text: step } : step;
      const stepText = `${source?.text || ""}`.trim();
      if (!stepText) return null;
      return {
        text: stepText,
        kind: source?.kind || (index === 0 ? "instruction" : "followup"),
        action: getAudienceWarmupAction(source?.action || action.id).id,
        ...(Number.isFinite(source?.delayMs) ? { delayMs: source.delayMs } : {}),
        ...(Number.isFinite(source?.durationSeconds) ? { durationSeconds: source.durationSeconds } : {})
      };
    }).filter(Boolean)
    : [];
  const generatedSteps = [
    { text, kind: "instruction", action: action.id },
    ...countdownSteps.map((stepText) => ({ text: stepText, kind: "count", action: action.id })),
    ...(reaction === false ? [] : (reactions[action.id] || ["ENTRADA REGISTRADA."]).map((stepText) => ({ text: stepText, kind: "reaction", action: action.id })))
  ];
  const sequenceSteps = normalizedAuthoredSteps.length ? normalizedAuthoredSteps : generatedSteps;
  return {
    id: `warmup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    promptId,
    label: action.label,
    action: action.id,
    category,
    intensity,
    interactionType,
    tags: [...tags],
    durationSeconds: Number.isFinite(durationSeconds) ? Math.max(1, Math.min(30, durationSeconds)) : null,
    progressId: promptId || `manual:${`${text || ""}`.trim().toLocaleLowerCase("pt-BR")}`,
    progressValue: Math.max(0, Math.min(100, Number(progressValue ?? action.progressValue) || 0)),
    repeatableProgress: Boolean(repeatableProgress ?? action.repeatableProgress),
    feedbackOverride: `${feedbackOverride || ""}`.trim() || null,
    requiresCountdown: normalizedAuthoredSteps.length ? false : requiresCountdown,
    countdown: normalizedAuthoredSteps.length ? null : countdownConfig,
    steps: sequenceSteps.map((step, index) => ({
      id: `${action.id}-${index}`,
      ...step
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
