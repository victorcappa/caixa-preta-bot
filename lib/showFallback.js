const FALLBACK_LIBRARY = Object.freeze({
  emergency: [
    "Continuamos por aqui. Sem atalhos.",
    "Agora eu prefiro o método manual. Mais lento. Mais humano.",
    "O protocolo mudou. A peça não."
  ],
  success: [
    "Funcionou. Não vamos estragar o momento explicando.",
    "Certo. Guardem essa rara eficiência.",
    "Ótimo. Seguimos antes que mude de ideia."
  ],
  failure: [
    "Não foi desta vez. O espetáculo sobrevive.",
    "Falhou com convicção. Vamos continuar.",
    "Resultado inconclusivo. Dramaturgicamente suficiente."
  ],
  silence: [
    "O silêncio também respondeu. Seguimos.",
    "Entendi. Ou decidi que entendi.",
    "Vou considerar isso uma resposta coletiva."
  ],
  suitcases: [
    "A mala continua aqui. O resto é procedimento.",
    "Ricardinho, mantenha a dignidade técnica. Vamos em frente.",
    "A ordem permanece. Abram espaço."
  ],
  warmup: [
    "A plateia ainda está funcional. Continuem.",
    "Participação registrada sem entusiasmo excessivo.",
    "Serve. Próxima tentativa humana."
  ],
  participant: [
    "A pessoa escolhida continua escolhida. Venha ao centro.",
    "Temos um participante. Isso já é comprometimento suficiente.",
    "Você foi selecionado. Não procure justiça no procedimento."
  ],
  transition: [
    "Um instante. Estou reorganizando o desastre.",
    "Continuamos. A interrupção não merece protagonismo.",
    "Ainda estou aqui. Isso basta para a próxima etapa."
  ],
  final: [
    "Chegamos até aqui. Contra algumas probabilidades.",
    "Fim do protocolo. O resto pertence a vocês.",
    "A sessão termina. A caixa permanece fechada."
  ]
});

function fallbackKey({ state = {}, userMessage = "", operatorInstruction = "" } = {}) {
  if (state.reliability?.emergencyMode?.active) return "emergency";

  const context = `${userMessage} ${operatorInstruction}`.toLocaleLowerCase("pt-BR");
  if (/\b(acert|sucesso|venceu|ganhou|conclu)/u.test(context)) return "success";
  if (/\b(errou|falh|perdeu|tempo|não conseguiu|nao conseguiu)/u.test(context)) return "failure";

  const sceneZero = state.sceneZero || {};
  if (sceneZero.stage === "suitcases") return "suitcases";
  if (sceneZero.stage === "participant") return "participant";
  if (["sound-check", "warmup"].includes(sceneZero.stage) || state.audienceWarmup?.active) return "warmup";
  if (sceneZero.suitcaseGame?.status === "finished" || state.mode === "final") return "final";
  if (!`${userMessage || ""}`.trim()) return "silence";
  return "transition";
}

function stableIndex(value, length) {
  let hash = 0;
  for (const character of `${value || ""}`) hash = ((hash * 31) + character.codePointAt(0)) >>> 0;
  return length ? hash % length : 0;
}

export function selectLocalShowFallback(options = {}) {
  const key = fallbackKey(options);
  const choices = FALLBACK_LIBRARY[key] || FALLBACK_LIBRARY.transition;
  const state = options.state || {};
  const seed = [
    key,
    state.sceneZero?.stage,
    state.sceneZero?.suitcaseGame?.status,
    state.audienceWarmup?.phase,
    options.userMessage,
    options.operatorInstruction,
    state.revision
  ].filter(Boolean).join("|");

  return {
    key,
    text: choices[stableIndex(seed, choices.length)]
  };
}

export function localFallbackTurn(options = {}) {
  const fallback = selectLocalShowFallback(options);
  return {
    text: fallback.text,
    events: [],
    salience: [],
    activity: null,
    game: null,
    suitcase: null,
    styleDebug: { fallback: true, key: fallback.key },
    research: { researchCalls: 0, instagramActions: 0, functionCalls: 0 },
    fallback: {
      active: true,
      key: fallback.key,
      reason: options.reason || "external-unavailable"
    }
  };
}

export function fallbackLibrarySummary() {
  return Object.fromEntries(Object.entries(FALLBACK_LIBRARY).map(([key, values]) => [key, values.length]));
}
