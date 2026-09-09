export const PLAY_UNLOCK_STATES = {
  STANDBY: "STANDBY",
  BOOTING: "BOOTING",
  WAITING_FOR_AUDIENCE: "WAITING_FOR_AUDIENCE",
  WARMING_AUDIENCE: "WARMING_AUDIENCE",
  UNLOCKING: "UNLOCKING",
  UNLOCKED: "UNLOCKED"
};

export const PLAY_UNLOCK_CONFIG = {
  bootLimit: 78,
  completeAnimationMs: 1800,
  animationFrames: 18,
  unlockStepMs: 620,
  handoffDurationMs: 2400,
  feedbackDurationMs: 1600,
  openingLine: "ainda falta uma coisa. vocês.",
  sounds: {
    tick: { frequency: 440, durationMs: 90, volume: 0.035, oscillator: "sine" },
    warning: { frequency: 190, durationMs: 150, volume: 0.045, oscillator: "square" },
    progress: { frequency: 610, durationMs: 80, volume: 0.03, oscillator: "sine" },
    unlock: { frequency: 880, durationMs: 110, volume: 0.04, oscillator: "square" }
  },
  bootSteps: [
    {
      id: "machine",
      progress: 8,
      durationMs: 520,
      sound: "tick",
      lines: ["CAIXA PRETA BIOS v0.0", "inicializando máquina..."]
    },
    {
      id: "theatre",
      progress: 18,
      durationMs: 620,
      sound: "tick",
      lines: ["TEATRO ........................ DETECTADO"]
    },
    {
      id: "deterministic-title",
      progress: 26,
      durationMs: 540,
      sound: "tick",
      lines: ["", "MÓDULOS DETERMINÍSTICOS"]
    },
    {
      id: "technical-a",
      progress: 38,
      durationMs: 820,
      sound: "tick",
      lines: [
        "Victor Cappa / programação .... OK",
        "Marcus / traquitanas .......... OK",
        "Matheus / som ................. OK"
      ]
    },
    {
      id: "technical-b",
      progress: 49,
      durationMs: 820,
      sound: "tick",
      lines: [
        "Vic / vídeo ................... OK",
        "Marina + Paula / cenário ...... OK",
        "Ricardo / Ricardinho / luz .... OK"
      ]
    },
    {
      id: "human-title",
      progress: 56,
      durationMs: 560,
      sound: "tick",
      lines: ["", "MÓDULOS NÃO DETERMINÍSTICOS"]
    },
    {
      id: "cast",
      progress: 68,
      durationMs: 850,
      sound: "tick",
      lines: [
        "ROBINSON ...................... OK",
        "NEI ........................... OK",
        "ISABELA ....................... OK"
      ]
    },
    {
      id: "audience",
      progress: 74,
      durationMs: 720,
      sound: "tick",
      lines: ["", "ENTRADA EXTERNA NÃO CONTROLADA", "PLATEIA ........................ DETECTADA"]
    },
    {
      id: "final-check",
      progress: 78,
      durationMs: 900,
      sound: "warning",
      lines: ["", "verificando participação..."]
    }
  ],
  stalledLines: [
    "PARTICIPAÇÃO ................... INSUFICIENTE",
    "",
    "ERRO: não foi possível concluir a inicialização.",
    "dependência necessária: JOGO DAS MALAS",
    "",
    "tentando desbloquear espetáculo...",
    "DESBLOQUEIE A PEÇA",
    "aguardando conclusão das malas...",
    "_"
  ],
  unlockLines: [
    "PARTICIPAÇÃO DA PLATEIA ........ OK",
    "AÇÃO COLETIVA .................. VALIDADA",
    "TODAS AS DEPENDÊNCIAS .......... SATISFEITAS",
    "desbloqueando sistema...",
    "...",
    "CAIXA PRETA .................... PRONTA",
    "PEÇA DESBLOQUEADA"
  ]
};

export function playUnlockBootLines(bootStep = -1) {
  return PLAY_UNLOCK_CONFIG.bootSteps
    .slice(0, Math.max(0, Number(bootStep) + 1))
    .flatMap((step) => step.lines);
}
