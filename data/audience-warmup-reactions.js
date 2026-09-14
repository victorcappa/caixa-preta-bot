export const AUDIENCE_WARMUP_REACTIONS = {
  few: [
    "Poucos se entregaram. Os outros aprenderam a esconder.",
    "Uma minoria respondeu. O resto preferiu sobreviver em silêncio.",
    "Quase ninguém. A cautela chegou antes da honestidade.",
    "Poucos sinais. Ainda assim, suficientes.",
    "A resposta foi pequena. O desconforto, nem tanto.",
    "Poucos admitiram. Eu não disse que a contagem era confiável.",
    "Baixa adesão. Alta suspeita.",
    "Uma fração do público resolveu colaborar.",
    "Poucos movimentos. Muitas tentativas de parecer invisível.",
    "Resposta discreta. Informação indiscreta.",
    "Quase nada na superfície. É onde costuma ficar interessante.",
    "Poucos responderam. Os demais responderam ficando parados.",
    "Adesão mínima. Registro completo.",
    "Uma pequena amostra já foi suficiente.",
    "Pouca gente assumiu. Guardem essa coragem.",
    "A maioria recuou. Também conta.",
    "Poucos se manifestaram. O silêncio ficou bastante eloquente.",
    "Resultado tímido. Público nem tanto.",
    "Só alguns. Obrigado por facilitarem a triagem.",
    "Poucos corpos obedeceram. Muitos olhos calcularam o risco."
  ],
  many: [
    "Nossa, toquei num ponto sensível.",
    "Informação demais. Obrigado.",
    "Olha só. Temos dados.",
    "Interessante... muitos culpados.",
    "Isso foi estatisticamente preocupante.",
    "Muita gente respondeu rápido demais.",
    "Uma adesão impressionante. E um pouco imprudente.",
    "Quase um consenso. Péssimo sinal.",
    "Muitos se reconheceram. Ninguém pareceu surpreso.",
    "Resposta volumosa. Sigilo insuficiente.",
    "O público inteiro parece ter algo a confessar.",
    "Excelente. Vocês economizaram meu trabalho.",
    "Muitos movimentos ao mesmo tempo. Difícil fingir inocência assim.",
    "Adesão alta. Autopreservação baixa.",
    "Vocês se expuseram com uma eficiência admirável.",
    "Isso reuniu gente demais do mesmo lado.",
    "A maioria colaborou. Talvez tenha sido confiança demais.",
    "Bastante resposta. Vou guardar essa distribuição.",
    "Muitos aceitaram o risco. Anotado.",
    "Uma quantidade desconfortável de confirmações."
  ]
};

const RESPONSE_VERBS = {
  sleep: ["FICARAM IMÓVEIS", "FICARAM IMÓVEIS"],
  stomp: ["BATERAM OS PÉS", "BATERAM OS PÉS"],
  scream: ["GRITARAM", "GRITARAM"],
  dance: ["DANÇARAM", "DANÇARAM"],
  mime: ["FIZERAM A MÍMICA", "FIZERAM A MÍMICA"],
  pose: ["FIZERAM A POSE", "FIZERAM A POSE"],
  sound: ["FIZERAM O SOM", "FIZERAM O SOM"],
  chorus: ["RESPONDERAM", "RESPONDERAM"],
  count: ["CONTARAM", "CONTARAM"],
  wave: ["FIZERAM A ONDA", "FIZERAM A ONDA"],
  shake: ["SE BALANÇARAM", "SE BALANÇARAM"],
  freeze: ["CONGELARAM", "CONGELARAM"],
  swap: ["TROCARAM DE LUGAR", "TROCARAM DE LUGAR"],
  imitate: ["IMITARAM", "IMITARAM"],
  hide: ["SE ESCONDERAM", "SE ESCONDERAM"],
  raise_object: ["LEVANTARAM O OBJETO", "LEVANTARAM O OBJETO"],
  touch_self: ["TOCARAM O CORPO", "TOCARAM O CORPO"],
  rhythm: ["FIZERAM O RITMO", "FIZERAM O RITMO"],
  competition: ["COMPETIRAM", "COMPETIRAM"],
  choice: ["ESCOLHERAM UM LADO", "ESCOLHERAM UM LADO"],
  move: ["SE MOVERAM", "SE MOVERAM"],
  look: ["OLHARAM", "OLHARAM"],
  point: ["APONTARAM", "APONTARAM"],
  stand: ["FICARAM DE PÉ", "FICARAM DE PÉ"],
  sit: ["SENTARAM", "SENTARAM"],
  clap: ["BATERAM PALMAS", "BATERAM PALMAS"],
  hand: ["LEVANTARAM A MÃO", "LEVANTARAM A MÃO"],
  eyes: ["FECHARAM OS OLHOS", "FECHARAM OS OLHOS"]
};

export function audienceWarmupResponseOptions(actionId) {
  const [fewVerb, manyVerb] = RESPONSE_VERBS[actionId] || ["REAGIRAM", "REAGIRAM"];
  return [
    { kind: "few", label: `POUCOS ${fewVerb}` },
    { kind: "many", label: `MUITOS ${manyVerb}` }
  ];
}

export const AUDIENCE_WARMUP_QUESTIONS_RESULT_COMMENT = "VOCÊS SE EXPUSERAM O SUFICIENTE. JÁ TENHO MATERIAL.";

export const AUDIENCE_WARMUP_MINIGAME_RESULT_COMMENTS = {
  tapao: "ALGUNS REFLEXOS. NENHUM REMORSO.",
  piscada: "CONTATO VISUAL TOLERADO. INTIMIDADE AINDA NÃO.",
  serinho: "AUTOCONTROLE LIMITADO. ERA O ESPERADO.",
  skipped: "VOCÊS PULARAM O TESTE. A COVARDIA TAMBÉM É UM RESULTADO.",
  default: "TESTE CONCLUÍDO. COMPORTAMENTO COLETIVO REGISTRADO."
};

export function audienceWarmupMinigameResultComment(gameId, { skipped = false } = {}) {
  if (skipped) return AUDIENCE_WARMUP_MINIGAME_RESULT_COMMENTS.skipped;
  return AUDIENCE_WARMUP_MINIGAME_RESULT_COMMENTS[gameId]
    || AUDIENCE_WARMUP_MINIGAME_RESULT_COMMENTS.default;
}

export function chooseAudienceWarmupReaction(kind, excludedTexts = [], random = Math.random) {
  const options = AUDIENCE_WARMUP_REACTIONS[kind] || AUDIENCE_WARMUP_REACTIONS.few;
  const excluded = new Set(Array.isArray(excludedTexts) ? excludedTexts : [excludedTexts].filter(Boolean));
  const available = options.filter((text) => !excluded.has(text));
  const pool = available.length ? available : options;
  const randomValue = Math.max(0, Math.min(0.999999, Number(random()) || 0));
  const selected = pool[Math.floor(randomValue * pool.length)];
  if (available.length) return selected;
  return `${selected} REGISTRO ${excluded.size + 1}.`;
}
