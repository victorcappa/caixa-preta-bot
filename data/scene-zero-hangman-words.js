export const SCENE_ZERO_HANGMAN_WORDS = [
  { id: "hangman-01", text: "TURBULÊNCIA", category: "aviação" },
  { id: "hangman-02", text: "COLISÃO", category: "acidente" },
  { id: "hangman-03", text: "ALTITUDE", category: "aviação" },
  { id: "hangman-04", text: "IMPACTO", category: "acidente" },
  { id: "hangman-05", text: "GRAVIDADE", category: "força G" },
  { id: "hangman-06", text: "DESTROÇOS", category: "acidente" },
  { id: "hangman-07", text: "CABINE", category: "aviação" },
  { id: "hangman-08", text: "PILOTO", category: "aviação" },
  { id: "hangman-09", text: "PASSAGEIRO", category: "corpo" },
  { id: "hangman-10", text: "QUEDA", category: "acidente" },
  { id: "hangman-11", text: "CAIXA PRETA", category: "arquivo" },
  { id: "hangman-12", text: "FORÇA G", category: "força G" },
  { id: "hangman-13", text: "AEROPORTO", category: "aviação" },
  { id: "hangman-14", text: "SOBREVIVENTE", category: "corpo" },
  { id: "hangman-15", text: "ACIDENTE", category: "acidente" },
  { id: "hangman-16", text: "INVESTIGAÇÃO", category: "arquivo" },
  { id: "hangman-17", text: "PÂNICO", category: "medo" },
  { id: "hangman-18", text: "TRAJETÓRIA", category: "aviação" },
  { id: "hangman-19", text: "CONTROLE", category: "máquina" },
  { id: "hangman-20", text: "FALHA HUMANA", category: "erro" },
  { id: "hangman-21", text: "TRANSPONDER", category: "máquina" },
  { id: "hangman-22", text: "CAIXA DE VOZ", category: "corpo" },
  { id: "hangman-23", text: "BURACO NEGRO", category: "território" },
  { id: "hangman-24", text: "MEMÓRIA", category: "arquivo" }
];

export const SCENE_ZERO_HANGMAN_MAX_ERRORS = 4;
export const SCENE_ZERO_HANGMAN_FLIGHT_STATES = [
  "ESTÁVEL",
  "ALERTA",
  "PERDA DE ALTITUDE",
  "FALHA",
  "IMPACTO"
];

export function getSceneZeroHangmanWord(wordId) {
  return SCENE_ZERO_HANGMAN_WORDS.find((entry) => entry.id === wordId) || null;
}
