import { PLAY_UNLOCK_CONFIG, PLAY_UNLOCK_STATES } from "../../data/scene-zero-unlock.js";

export function createInitialPlayUnlockState(now = new Date().toISOString()) {
  return {
    status: PLAY_UNLOCK_STATES.STANDBY,
    progress: 0,
    bootLimit: PLAY_UNLOCK_CONFIG.bootLimit,
    bootStep: -1,
    bootPaused: false,
    bootComplete: false,
    startedAt: null,
    handoffUntil: null,
    verificationTitleShownAt: null,
    verificationTitleUntil: null,
    verificationTitleSequence: 0,
    lastProgressAction: null,
    lastIncreaseAction: null,
    executedActionIds: [],
    scoredActionIds: [],
    technicalFeedback: null,
    technicalFeedbackUntil: null,
    feedbackSequence: 0,
    feedbackIndex: -1,
    soundEnabled: true,
    soundSequence: 0,
    animation: null,
    pendingProgress: null,
    unlockSequenceIndex: -1,
    unlockSequenceSource: null,
    unlockedAt: null,
    eventSequence: 0,
    onPlayUnlocked: null,
    externalInput: null,
    updatedAt: now
  };
}

export function startPlayUnlockBoot(state, now = new Date().toISOString()) {
  return {
    ...createInitialPlayUnlockState(now),
    status: PLAY_UNLOCK_STATES.BOOTING,
    soundEnabled: state?.soundEnabled !== false,
    startedAt: now,
    updatedAt: now
  };
}

export function advancePlayUnlockBoot(state, now = new Date().toISOString()) {
  if (state.status !== PLAY_UNLOCK_STATES.BOOTING) return { state, complete: true, advanced: false };
  const nextStep = Number(state.bootStep ?? -1) + 1;
  const step = PLAY_UNLOCK_CONFIG.bootSteps[nextStep];
  if (!step) return { state, complete: true, advanced: false };
  return {
    advanced: true,
    complete: nextStep === PLAY_UNLOCK_CONFIG.bootSteps.length - 1,
    step,
    state: {
      ...state,
      progress: Math.min(PLAY_UNLOCK_CONFIG.bootLimit, step.progress),
      bootStep: nextStep,
      lastProgressAction: `BIOS / ${step.id}`,
      lastIncreaseAction: `BIOS / ${step.id}`,
      soundSequence: Number(state.soundSequence || 0) + 1,
      updatedAt: now
    }
  };
}

export function stallPlayUnlockBoot(state, now = new Date().toISOString()) {
  return {
    ...state,
    status: PLAY_UNLOCK_STATES.BOOT_FAILED,
    progress: PLAY_UNLOCK_CONFIG.bootLimit,
    bootLimit: PLAY_UNLOCK_CONFIG.bootLimit,
    bootComplete: true,
    bootPaused: false,
    handoffUntil: new Date(Date.parse(now) + PLAY_UNLOCK_CONFIG.bootFailureDurationMs).toISOString(),
    lastProgressAction: "BIOS interrompida / participação insuficiente",
    technicalFeedback: "PARTICIPAÇÃO ................... INSUFICIENTE",
    technicalFeedbackUntil: new Date(Date.parse(now) + PLAY_UNLOCK_CONFIG.bootFailureDurationMs).toISOString(),
    feedbackSequence: Number(state.feedbackSequence || 0) + 1,
    soundSequence: Number(state.soundSequence || 0) + 1,
    updatedAt: now
  };
}

export function beginPlayUnlockHumanVerification(state, now = new Date().toISOString()) {
  if (state.status !== PLAY_UNLOCK_STATES.BOOT_FAILED) return state;
  return {
    ...state,
    status: PLAY_UNLOCK_STATES.HUMAN_VERIFICATION,
    verificationTitleShownAt: now,
    verificationTitleUntil: new Date(Date.parse(now) + PLAY_UNLOCK_CONFIG.verificationTitleDurationMs).toISOString(),
    verificationTitleSequence: Number(state.verificationTitleSequence || 0) + 1,
    technicalFeedback: null,
    technicalFeedbackUntil: null,
    soundSequence: Number(state.soundSequence || 0) + 1,
    updatedAt: now
  };
}

export function readyPlayUnlockAudience(state, now = new Date().toISOString()) {
  if (state.status !== PLAY_UNLOCK_STATES.HUMAN_VERIFICATION) return state;
  return {
    ...state,
    status: PLAY_UNLOCK_STATES.WAITING_FOR_AUDIENCE,
    handoffUntil: null,
    technicalFeedback: null,
    technicalFeedbackUntil: null,
    updatedAt: now
  };
}

export function recordPlayUnlockAudienceAction(state, {
  label,
  progressId = null,
  progressValue = 0,
  repeatableProgress = false,
  feedbackOverride = null,
  externalInput = null,
  now = new Date().toISOString()
} = {}) {
  if (![PLAY_UNLOCK_STATES.WAITING_FOR_AUDIENCE, PLAY_UNLOCK_STATES.WARMING_AUDIENCE].includes(state.status)) {
    return { state, applied: false, reason: "NOT_WARMING" };
  }
  return {
    applied: true,
    state: {
      ...state,
      status: PLAY_UNLOCK_STATES.WARMING_AUDIENCE,
      progress: state.progress,
      lastProgressAction: `${label || "ação coletiva"} / aguardando avaliação do operador`,
      executedActionIds: progressId && !(state.executedActionIds || []).includes(progressId)
        ? [...(state.executedActionIds || []), progressId]
        : [...(state.executedActionIds || [])],
      technicalFeedback: null,
      technicalFeedbackUntil: null,
      animation: null,
      pendingProgress: null,
      externalInput: {
        ...externalInput,
        progressId,
        progressValue: Math.max(0, Math.round(Number(progressValue) || 0)),
        repeatableProgress: Boolean(repeatableProgress),
        feedbackOverride
      },
      updatedAt: now
    }
  };
}

function nextTechnicalFeedback(state, override = null) {
  const feedbacks = PLAY_UNLOCK_CONFIG.technicalFeedbacks;
  let nextIndex = (Number(state.feedbackIndex ?? -1) + 1) % feedbacks.length;
  let text = `${override || ""}`.trim() || feedbacks[nextIndex];
  if (text === state.technicalFeedback) {
    nextIndex = (nextIndex + 1) % feedbacks.length;
    text = feedbacks[nextIndex];
  } else if (override) {
    const configuredIndex = feedbacks.indexOf(text);
    if (configuredIndex >= 0) nextIndex = configuredIndex;
  }
  return { text, index: nextIndex };
}

export function preparePlayUnlockProgress(state, delta, {
  label = "avaliação do operador",
  evaluationId = null,
  repeatableProgress = null,
  feedbackOverride = null,
  allowWithoutAction = false,
  now = new Date().toISOString()
} = {}) {
  if (![PLAY_UNLOCK_STATES.WAITING_FOR_AUDIENCE, PLAY_UNLOCK_STATES.WARMING_AUDIENCE].includes(state.status)) {
    return { state, applied: false, reason: "NOT_WARMING" };
  }
  if (state.pendingProgress) return { state, applied: false, reason: "PROGRESS_PENDING" };
  const amount = Math.round(Number(delta) || 0);
  if (!amount) return { state, applied: false, reason: "ZERO_PROGRESS" };
  const input = state.externalInput || {};
  const repeatable = repeatableProgress ?? input.repeatableProgress;
  const actionId = evaluationId || (repeatable ? input.sequenceId : input.progressId || input.sequenceId);
  if (!actionId && !allowWithoutAction) return { state, applied: false, reason: "NO_ACTION_TO_EVALUATE" };
  if (!repeatable && actionId && (state.scoredActionIds || []).includes(actionId)) {
    return { state, applied: false, reason: "ACTION_ALREADY_EVALUATED" };
  }
  const feedback = nextTechnicalFeedback(state, feedbackOverride || input.feedbackOverride);
  return {
    applied: true,
    state: {
      ...state,
      status: PLAY_UNLOCK_STATES.WARMING_AUDIENCE,
      technicalFeedback: feedback.text,
      technicalFeedbackUntil: new Date(Date.parse(now) + PLAY_UNLOCK_CONFIG.feedbackDurationMs).toISOString(),
      feedbackSequence: Number(state.feedbackSequence || 0) + 1,
      feedbackIndex: feedback.index,
      soundSequence: Number(state.soundSequence || 0) + 1,
      pendingProgress: { amount, label, evaluationId: actionId, repeatableProgress: Boolean(repeatable) },
      updatedAt: now
    }
  };
}

export function commitPlayUnlockProgress(state, now = new Date().toISOString()) {
  const pending = state.pendingProgress;
  if (!pending) return { state, applied: false, reason: "NO_PROGRESS_PENDING" };
  const previousProgress = Number(state.progress || 0);
  const progress = Math.max(0, Math.min(100, previousProgress + pending.amount));
  const scoredActionIds = pending.evaluationId && !pending.repeatableProgress
    ? [...new Set([...(state.scoredActionIds || []), pending.evaluationId])]
    : [...(state.scoredActionIds || [])];
  return {
    applied: true,
    state: {
      ...state,
      progress,
      scoredActionIds,
      lastProgressAction: pending.label,
      lastIncreaseAction: progress > previousProgress ? pending.label : state.lastIncreaseAction,
      animation: null,
      pendingProgress: null,
      externalInput: state.externalInput
        ? { ...state.externalInput, source: "operator", evaluation: pending.amount > 0 ? "increase" : "decrease", automaticDetection: false }
        : state.externalInput,
      updatedAt: now
    }
  };
}

export function adjustPlayUnlockProgress(state, delta, {
  label = "avaliação do operador",
  evaluationId = null,
  repeatableProgress = null,
  feedbackOverride = null,
  allowWithoutAction = false,
  now = new Date().toISOString()
} = {}) {
  const prepared = preparePlayUnlockProgress(state, delta, {
    label,
    evaluationId,
    repeatableProgress,
    feedbackOverride,
    allowWithoutAction,
    now
  });
  return prepared.applied ? commitPlayUnlockProgress(prepared.state, now) : prepared;
}

export function completePlayUnlock(state, {
  source = "operator",
  now = new Date().toISOString()
} = {}) {
  return {
    ...state,
    status: PLAY_UNLOCK_STATES.UNLOCKED,
    progress: 100,
    animation: null,
    pendingProgress: null,
    unlockSequenceIndex: PLAY_UNLOCK_CONFIG.unlockLines.length - 1,
    unlockedAt: now,
    eventSequence: Number(state.eventSequence || 0) + 1,
    soundSequence: Number(state.soundSequence || 0) + 1,
    onPlayUnlocked: {
      name: "onPlayUnlocked",
      source,
      sequence: Number(state.eventSequence || 0) + 1,
      timestamp: now
    },
    updatedAt: now
  };
}
