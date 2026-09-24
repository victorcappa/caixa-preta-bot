export const SCENE_ZERO_PHYSICAL_CHALLENGES = [
  {
    id: "bexigas-chave",
    text: "ESTOURE AS BEXIGAS ATÉ ENCONTRAR A CHAVE.",
    presentation: "Você terá apenas 15 segundos.",
    target: 1,
    targetLabel: "CHAVE",
    objectDuration: 15,
    duration: 15,
    category: "bexigas / chave",
    intensity: "alta",
    successMessage: "CHAVE ENCONTRADA.",
    failureMessage: "A CHAVE CONTINUA ESCONDIDA."
  }
];

export function getSceneZeroPhysicalChallenge(challengeId) {
  return SCENE_ZERO_PHYSICAL_CHALLENGES.find((challenge) => challenge.id === challengeId) || null;
}
