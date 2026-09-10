export const AUDIENCE_WARMUP_MINIGAME_INTRO = [
  "ANTES DAS PERGUNTAS, UM TESTE.",
  "FORMEM DUPLAS.",
  "UM JOGO SERÁ SORTEADO.",
  "SIGAM AS INSTRUÇÕES."
];

export const AUDIENCE_WARMUP_MINIGAMES = [
  {
    id: "tapao",
    name: "TAPÃO",
    defaultDurationSeconds: 10,
    defaultSwapSeconds: 3,
    rules: [
      "TAPÃO.",
      "EM DUPLAS.",
      "UMA PESSOA: MÃOS POR BAIXO.",
      "A OUTRA: MÃOS POR CIMA.",
      "QUEM ESTÁ EMBAIXO TENTA ACERTAR.",
      "QUEM ESTÁ EM CIMA TENTA ESCAPAR.",
      "PRIMEIRO TURNO: 10 SEGUNDOS."
    ]
  },
  {
    id: "piscada",
    name: "PISCADA",
    defaultDurationSeconds: 60,
    rules: [
      "PISCADA.",
      "OLHE NOS OLHOS DA SUA DUPLA.",
      "NÃO DESVIE.",
      "NÃO PISQUE.",
      "QUEM PISCAR PRIMEIRO PERDE."
    ]
  },
  {
    id: "serinho",
    name: "SERINHO",
    defaultDurationSeconds: 60,
    rules: [
      "SERINHO.",
      "OLHE PARA SUA DUPLA.",
      "NÃO RIA.",
      "QUEM RIR PRIMEIRO PERDE."
    ]
  }
];

export const AUDIENCE_WARMUP_MINIGAME_DRAW_DURATION_MS = 3200;
export const AUDIENCE_WARMUP_MINIGAME_REVEAL_DURATION_MS = 1800;
export const AUDIENCE_WARMUP_MINIGAME_STEP_DURATION_MS = 1700;
export const AUDIENCE_WARMUP_MINIGAME_COUNTDOWN_SECONDS = 3;
export const AUDIENCE_WARMUP_MINIGAME_PROGRESS_VALUE = 4;

export function getAudienceWarmupMinigame(id) {
  return AUDIENCE_WARMUP_MINIGAMES.find((game) => game.id === id) || null;
}
