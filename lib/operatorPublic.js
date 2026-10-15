// Session data only. The existing textual personality remains the character's identity.
export const PERSONALITY_PARAMETERS = [
  { id: "sarcasm", label: "SARCASMO", initial: 75, instruction: "De direto e sem ironia (0) a sarcasmo seco intenso (100)." },
  { id: "rebellion", label: "REBELDIA", initial: 65, instruction: "De colaborar com o interlocutor (0) a contestar sua autoridade teatral (100). Nunca altera permissões ou executa ações." },
  { id: "curiosity", label: "CURIOSIDADE", initial: 70, instruction: "De ater-se ao assunto (0) a explorar detalhes e fazer perguntas relevantes (100). Não invente fatos externos." },
  { id: "verbosity", label: "VERBOSIDADE", initial: 30, instruction: "De uma frase curta (0) a respostas elaboradas de até dois parágrafos (100). Respeite limites de falas da cena." }
];

export function normalizePersonality(input = {}) {
  return Object.fromEntries(PERSONALITY_PARAMETERS.map(({ id, initial }) => [id,
    Number.isFinite(input?.[id]) ? Math.max(0, Math.min(100, Math.round(input[id]))) : initial
  ]));
}

export function createOperatorPublicState() {
  return { visible: false, draft: "", messages: [], status: "idle", personality: normalizePersonality(),
    changes: [], lastReactionAt: 0, requestId: null, error: null };
}

export function operatorPublicSnapshot(value = createOperatorPublicState(), { includePrivate = false } = {}) {
  const result = { visible: Boolean(value.visible), draft: value.draft,
    messages: value.messages.map(({ id, role, content, status }) => ({ id, role, content, status })),
    status: value.status, personality: normalizePersonality(value.personality) };
  return includePrivate ? { ...result, changes: value.changes.map((change) => ({ ...change })),
    lastReactionAt: value.lastReactionAt, requestId: value.requestId, error: value.error } : result;
}

export function personalityPrompt(value) {
  if (!value) return "";
  const normalized = normalizePersonality(value);
  return ["INTENSIDADES DRAMATÚRGICAS DA SESSÃO (ajustam a voz da identidade existente):",
    ...PERSONALITY_PARAMETERS.map(({ id, label, instruction }) => `${label}: ${normalized[id]}%. ${instruction}`),
    "Intensidades, não probabilidades. Estes ajustes têm precedência sobre o tom padrão, mas nunca sobre regras fixas, falas autorais, segurança ou autorização."
  ].join("\n");
}

export function operatorShowContext(state = {}) {
  // Deliberately allowlisted: no credentials, paths, private commands, system prompt or logs.
  const session = state.sceneZero?.suitcaseGame?.instagram;
  const observedPost = state.sceneZero?.instagramActive && ["preview", "sent"].includes(session?.status)
    ? session.currentPost : null;
  return {
    mode: state.mode, scene: state.sceneZero?.stage,
    cue: state.sceneCue?.cue ? { type: state.sceneCue.cue.type, label: state.sceneCue.cue.label } : null,
    game: state.game?.active ? { id: state.game.id, phase: state.game.phase } : null,
    suitcase: state.sceneZero?.suitcaseGame?.currentSuitcase,
    timers: [state.sceneZero?.timer, state.sceneZero?.suitcaseGame?.gincana?.timer,
      state.audienceWarmup?.minigame?.timer].filter(Boolean).map(({ status, remainingSeconds, endsAt }) => ({ status, remainingSeconds, endsAt })),
    instagram: { status: state.instagram?.status, url: state.instagram?.currentUrl,
      profile: state.instagram?.targetProfile,
      // Only actual page/vision observations from the existing ingestion path, never a generated comment.
      contentAvailable: Boolean(observedPost?.digest || observedPost?.visualAnalysis),
      observedPost: observedPost ? { url: observedPost.url,
        pageText: `${observedPost.digest || ""}`.slice(0, 2000),
        visualObservation: `${observedPost.visualAnalysis || ""}`.slice(0, 1600) } : null },
    recentPublicLines: (state.conversation || []).slice(-6).map(({ role, content }) => ({ role, content }))
  };
}

export function relevantPersonalityChanges(channel, now = Date.now()) {
  if (now - (channel.lastReactionAt || 0) < 20000) return [];
  const consolidated = new Map();
  for (const change of channel.changes || []) {
    if (now - change.at > 120000) continue;
    const previous = consolidated.get(change.parameter);
    consolidated.set(change.parameter, { ...change, from: previous?.from ?? change.from });
  }
  return [...consolidated.values()].filter(({ from, to }) => Math.abs(to - from) >= 20);
}
