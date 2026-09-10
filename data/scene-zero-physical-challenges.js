export const SCENE_ZERO_PHYSICAL_CHALLENGES = [
  {
    id: "seis-sapatos",
    text: "CONSIGA 6 SAPATOS DA PLATEIA EM 10 SEGUNDOS.",
    target: 6,
    duration: 10,
    category: "objetos",
    intensity: "alta",
    successMessage: "DESAFIO CONCLUÍDO.",
    failureMessage: "INSUFICIENTE."
  },
  {
    id: "oito-objetos-vermelhos",
    text: "CONSIGA 8 OBJETOS VERMELHOS EM 10 SEGUNDOS.",
    target: 8,
    duration: 10,
    category: "objetos",
    intensity: "alta",
    successMessage: "DESAFIO CONCLUÍDO.",
    failureMessage: "TEMPO ESGOTADO."
  },
  {
    id: "cinco-pessoas-em-pe",
    text: "CONSIGA 5 PESSOAS DE PÉ EM 5 SEGUNDOS.",
    target: 5,
    duration: 5,
    category: "corpos",
    intensity: "média",
    successMessage: "DESAFIO CONCLUÍDO.",
    failureMessage: "INSUFICIENTE."
  },
  {
    id: "quatro-oculos",
    text: "CONSIGA 4 ÓCULOS EM 10 SEGUNDOS.",
    target: 4,
    duration: 10,
    category: "objetos",
    intensity: "média",
    successMessage: "REGISTRO COMPLETO.",
    failureMessage: "TEMPO ESGOTADO."
  },
  {
    id: "tres-casacos",
    text: "CONSIGA 3 CASACOS EM 8 SEGUNDOS.",
    target: 3,
    duration: 8,
    category: "objetos",
    intensity: "média",
    successMessage: "DESAFIO CONCLUÍDO.",
    failureMessage: "INSUFICIENTE."
  },
  {
    id: "sete-celulares",
    text: "CONSIGA 7 CELULARES LEVANTADOS EM 5 SEGUNDOS.",
    target: 7,
    duration: 5,
    category: "corpos",
    intensity: "alta",
    successMessage: "7/7. DESAFIO CONCLUÍDO.",
    failureMessage: "TEMPO ESGOTADO."
  },
  {
    id: "dez-maos-centro",
    text: "JUNTE 10 MÃOS NO CENTRO EM 7 SEGUNDOS.",
    target: 10,
    duration: 7,
    category: "contato",
    intensity: "alta",
    successMessage: "10/10. REGISTRADO.",
    failureMessage: "INSUFICIENTE."
  },
  {
    id: "cinco-tocando-mala",
    text: "CONSIGA 5 PESSOAS TOCANDO A MALA EM 8 SEGUNDOS.",
    target: 5,
    duration: 8,
    category: "deslocamento",
    intensity: "alta",
    successMessage: "DESAFIO CONCLUÍDO.",
    failureMessage: "TEMPO ESGOTADO."
  },
  {
    id: "oito-trocam-lugar",
    text: "FAÇA 8 PESSOAS TROCAREM DE LUGAR EM 10 SEGUNDOS.",
    target: 8,
    duration: 10,
    category: "deslocamento",
    intensity: "alta",
    successMessage: "DISTRIBUIÇÃO ALTERADA.",
    failureMessage: "INSUFICIENTE."
  },
  {
    id: "seis-palmas-sincronizadas",
    text: "CONSIGA 6 PESSOAS BATENDO PALMAS AO MESMO TEMPO EM 8 SEGUNDOS.",
    target: 6,
    duration: 8,
    category: "sincronia",
    intensity: "média",
    successMessage: "SINCRONIZAÇÃO ACEITA.",
    failureMessage: "SINCRONIZAÇÃO INSUFICIENTE."
  },
  {
    id: "cinco-pessoas-abaixadas",
    text: "FAÇA 5 PESSOAS SE ABAIXAREM EM 5 SEGUNDOS.",
    target: 5,
    duration: 5,
    category: "corpos",
    intensity: "alta",
    successMessage: "DESAFIO CONCLUÍDO.",
    failureMessage: "TEMPO ESGOTADO."
  },
  {
    id: "quatro-sem-sapato",
    text: "CONSIGA 4 PESSOAS SEM UM SAPATO EM 10 SEGUNDOS.",
    target: 4,
    duration: 10,
    category: "corpos",
    intensity: "alta",
    successMessage: "4/4. REGISTRADO.",
    failureMessage: "INSUFICIENTE."
  }
];

export function getSceneZeroPhysicalChallenge(challengeId) {
  return SCENE_ZERO_PHYSICAL_CHALLENGES.find((challenge) => challenge.id === challengeId) || null;
}
