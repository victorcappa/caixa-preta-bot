export const SCENE_ZERO_MANDATORY_DEAD_ACTION = {
  text: "TODOS FINJAM ESTAR MORTOS NAS CADEIRAS E NO CHÃO.",
  duration: 30
};

function objectChallenge(id, text, target, objectDuration = 15, options = {}) {
  return {
    id,
    text,
    target,
    objectDuration,
    mandatoryAction: SCENE_ZERO_MANDATORY_DEAD_ACTION.text,
    mandatoryDuration: SCENE_ZERO_MANDATORY_DEAD_ACTION.duration,
    duration: objectDuration + SCENE_ZERO_MANDATORY_DEAD_ACTION.duration,
    category: "objetos / plateia",
    intensity: options.intensity || "média",
    successMessage: options.successMessage || "DESAFIO CONCLUÍDO.",
    failureMessage: options.failureMessage || "TEMPO ESGOTADO."
  };
}

export const SCENE_ZERO_PHYSICAL_CHALLENGES = [
  objectChallenge("seis-sapatos", "CONSIGA 6 SAPATOS COM AJUDA DA PLATEIA.", 6, 15, { intensity: "alta" }),
  objectChallenge("oito-objetos-vermelhos", "CONSIGA 8 OBJETOS VERMELHOS COM AJUDA DA PLATEIA.", 8, 15, { intensity: "alta" }),
  objectChallenge("quatro-oculos", "CONSIGA 4 ÓCULOS COM AJUDA DA PLATEIA.", 4, 12),
  objectChallenge("tres-casacos", "CONSIGA 3 CASACOS COM AJUDA DA PLATEIA.", 3, 12),
  objectChallenge("sete-celulares", "CONSIGA 7 CELULARES LEVANTADOS COM AJUDA DA PLATEIA.", 7, 10, { intensity: "alta" }),
  objectChallenge("cinco-chaves", "CONSIGA 5 CHAVES COM AJUDA DA PLATEIA.", 5, 15),
  objectChallenge("moedas-e-caneta", "CONSIGA 3 MOEDAS E 1 CANETA COM AJUDA DA PLATEIA.", 4, 15),
  objectChallenge("cinco-papeis", "CONSIGA 5 PAPÉIS IMPRESSOS COM AJUDA DA PLATEIA.", 5, 15),
  objectChallenge("quatro-objetos-azuis", "CONSIGA 4 OBJETOS AZUIS COM AJUDA DA PLATEIA.", 4, 12),
  objectChallenge("seis-cartoes", "CONSIGA 6 CARTÕES COM AJUDA DA PLATEIA.", 6, 15, { intensity: "alta" }),
  objectChallenge("tres-objetos-com-data", "CONSIGA 3 OBJETOS COM UMA DATA VISÍVEL COM AJUDA DA PLATEIA.", 3, 15),
  objectChallenge("cinco-objetos-sonoros", "CONSIGA 5 OBJETOS QUE FAÇAM SOM COM AJUDA DA PLATEIA.", 5, 15, { intensity: "alta" })
];

export function getSceneZeroPhysicalChallenge(challengeId) {
  return SCENE_ZERO_PHYSICAL_CHALLENGES.find((challenge) => challenge.id === challengeId) || null;
}
