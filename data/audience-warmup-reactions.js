export const AUDIENCE_WARMUP_REACTIONS = {
  none: [
    "Nossa. Entusiasmo contagiante.",
    "Vou interpretar esse silêncio como colaboração.",
    "Interessante. Nenhum sinal de vida dessa vez.",
    "Certo. Essa claramente funcionou.",
    "Anotado: público extremamente participativo."
  ],
  many: [
    "Nossa, toquei num ponto sensível.",
    "Informação demais. Obrigado.",
    "Olha só. Temos dados.",
    "Interessante... muitos culpados.",
    "Isso foi estatisticamente preocupante."
  ]
};

export function chooseAudienceWarmupReaction(kind, previousText = "", random = Math.random) {
  const options = AUDIENCE_WARMUP_REACTIONS[kind] || AUDIENCE_WARMUP_REACTIONS.none;
  const available = options.filter((text) => text !== previousText);
  const pool = available.length ? available : options;
  const randomValue = Math.max(0, Math.min(0.999999, Number(random()) || 0));
  return pool[Math.floor(randomValue * pool.length)];
}
