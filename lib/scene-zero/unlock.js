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
    lastProgressAction: null,
    lastIncreaseAction: null,
    scoredActionIds: [],
    technicalFeedback: null,
    technicalFeedbackUntil: null,
    feedbackSequence: 0,
    soundEnabled: true,
    soundSequence: 0,
    animation: null,
    unlockSequenceIndex: -1,
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
    status: PLAY_UNLOCK_STATES.WAITING_FOR_AUDIENCE,
    progress: PLAY_UNLOCK_CONFIG.bootLimit,
    bootLimit: PLAY_UNLOCK_CONFIG.bootLimit,
    bootComplete: true,
    bootPaused: false,
    handoffUntil: new Date(Date.parse(now) + PLAY_UNLOCK_CONFIG.handoffDurationMs).toISOString(),
    lastProgressAction: "BIOS interrompida / participação insuficiente",
    technicalFeedback: "PARTICIPAÇÃO ................... INSUFICIENTE",
    technicalFeedbackUntil: new Date(Date.parse(now) + PLAY_UNLOCK_CONFIG.handoffDurationMs).toISOString(),
    feedbackSequence: Number(state.feedbackSequence || 0) + 1,
    soundSequence: Number(state.soundSequence || 0) + 1,
    updatedAt: now
  };
}

export function recordPlayUnlockAudienceAction(state, {
  label,
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
      progress: PLAY_UNLOCK_CONFIG.bootLimit,
      lastProgressAction: `${label || "ação coletiva"} / barra aguardando fim das malas`,
      technicalFeedback: "AÇÃO COLETIVA ................. REGISTRADA · MALAS PENDENTES",
      technicalFeedbackUntil: new Date(Date.parse(now) + PLAY_UNLOCK_CONFIG.feedbackDurationMs).toISOString(),
      feedbackSequence: Number(state.feedbackSequence || 0) + 1,
      animation: null,
      externalInput,
      updatedAt: now
    }
  };
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
