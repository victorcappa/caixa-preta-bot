export const PLAY_UNLOCK_STATES = {
  STANDBY: "STANDBY",
  BOOTING: "BOOTING",
  BOOT_FAILED: "BOOT_FAILED",
  HUMAN_VERIFICATION: "HUMAN_VERIFICATION",
  WAITING_FOR_AUDIENCE: "WAITING_FOR_AUDIENCE",
  WARMING_AUDIENCE: "WARMING_AUDIENCE",
  UNLOCKING: "UNLOCKING",
  UNLOCKED: "UNLOCKED"
};

export const PLAY_UNLOCK_CONFIG = {
  bootLimit: 78,
  manualProgressStep: 2,
  feedbackLeadMs: 480,
  bootFailureDurationMs: 2800,
  verificationTitleDurationMs: 3200,
  completeAnimationMs: 1800,
  animationFrames: 18,
  unlockStepMs: 620,
  feedbackDurationMs: 1600,
  verificationTitle: "... PROVE QUE VOCÊ É HUMANO",
  firstPromptId: "transport-01",
  sounds: {
    tick: { frequency: 440, durationMs: 90, volume: 0.035, oscillator: "sine" },
    warning: { frequency: 190, durationMs: 150, volume: 0.045, oscillator: "square" },
    progress: { frequency: 610, durationMs: 80, volume: 0.03, oscillator: "sine" },
    verification: { frequency: 330, durationMs: 180, volume: 0.045, oscillator: "square" },
    unlock: { frequency: 880, durationMs: 110, volume: 0.04, oscillator: "square" }
  },
  bootSteps: [
    {
      id: "machine",
      progress: 5,
      durationMs: 520,
      sound: "tick",
      lines: ["CAIXA PRETA BIOS v0.0", "inicializando máquina..."]
    },
    {
      id: "theatre",
      progress: 12,
      durationMs: 620,
      sound: "tick",
      lines: ["TEATRO ........................ DETECTADO"]
    },
    {
      id: "deterministic-title",
      progress: 19,
      durationMs: 540,
      sound: "tick",
      lines: ["", "MÓDULOS TÉCNICOS"]
    },
    {
      id: "technical-a",
      progress: 30,
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
      progress: 42,
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
      progress: 49,
      durationMs: 560,
      sound: "tick",
      lines: ["", "MÓDULOS HUMANOS / NÃO DETERMINÍSTICOS"]
    },
    {
      id: "cast",
      progress: 59,
      durationMs: 850,
      sound: "tick",
      lines: [
        "ROBINSON ...................... OK",
        "NEI ........................... OK",
        "ISABELA ....................... OK"
      ]
    },
    {
      id: "final-verification",
      progress: 70,
      durationMs: 1100,
      sound: "tick",
      lines: [
        "",
        "verificação final...",
        "programação .................... OK",
        "traquitanas .................... OK",
        "som ............................ OK",
        "vídeo .......................... OK",
        "cenário ........................ OK",
        "luz ............................ OK",
        "",
        "TEATRO ......................... OK"
      ]
    },
    {
      id: "audience",
      progress: 78,
      durationMs: 900,
      sound: "warning",
      lines: [
        "PLATEIA ........................ DETECTADA",
        "",
        "verificando participação..."
      ]
    }
  ],
  stalledLines: [
    "PARTICIPAÇÃO ................... INSUFICIENTE",
    "",
    "ERRO:",
    "não foi possível concluir a inicialização.",
    "",
    "dependência necessária:",
    "",
    "AÇÃO COLETIVA",
    "",
    "_"
  ],
  technicalFeedbacks: [
    "AÇÃO COLETIVA ................. DETECTADA",
    "RESPOSTA HUMANA ............... RECEBIDA",
    "MOVIMENTO COLETIVO ............ REGISTRADO",
    "RESPOSTA SONORA ............... RECEBIDA",
    "SINCRONIZAÇÃO ................. ACEITÁVEL",
    "ATENÇÃO COMPARTILHADA ......... DETECTADA",
    "COESÃO DA PLATEIA ............. AUMENTANDO",
    "PADRÃO HUMANO ................. COMPATÍVEL",
    "COMPORTAMENTO ORGÂNICO ........ DETECTADO",
    "REAÇÃO COLETIVA ............... VÁLIDA",
    "SINAL NÃO AUTOMATIZADO ........ PROVÁVEL",
    "ENTRADA EXTERNA ............... ACEITA",
    "VERIFICAÇÃO HUMANA ............ EM ANDAMENTO"
  ],
  unlockLines: [
    "VERIFICAÇÃO HUMANA ............ CONCLUÍDA",
    "PARTICIPAÇÃO DA PLATEIA ........ OK",
    "TODAS AS DEPENDÊNCIAS .......... SATISFEITAS",
    "desbloqueando...",
    "...",
    "CAIXA PRETA .................... PRONTA"
  ],
  tutorialCompleteLines: ["FIM DO TUTORIAL"],
  tutorialCompleteLeadMs: 550,
  tutorialCompleteDurationMs: 2600
};

export function playUnlockSequenceLines(source = "progress") {
  return source === "suitcases-finished"
    ? PLAY_UNLOCK_CONFIG.tutorialCompleteLines
    : PLAY_UNLOCK_CONFIG.unlockLines;
}

export function playUnlockBootLines(bootStep = -1) {
  return PLAY_UNLOCK_CONFIG.bootSteps
    .slice(0, Math.max(0, Number(bootStep) + 1))
    .flatMap((step) => step.lines);
}
