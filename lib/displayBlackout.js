export const DISPLAY_BLACKOUT_TARGETS = {
  chatbot: {
    id: "chatbot",
    label: "CHATBOT",
    aliases: ["chat", "bot", "caixa", "principal"]
  },
  baralho: {
    id: "baralho",
    label: "BARALHO",
    aliases: ["baralho-morbido", "morbido", "cartas"]
  },
  legenda: {
    id: "legenda",
    label: "LEGENDA",
    aliases: ["queda", "queda-aviao", "texto", "subtitle", "subtitles"]
  }
};

const TARGET_IDS = Object.keys(DISPLAY_BLACKOUT_TARGETS);

export function createInitialDisplayBlackoutState() {
  return {
    targets: Object.fromEntries(TARGET_IDS.map((target) => [target, false])),
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    sequence: 0
  };
}

export function normalizeDisplayBlackoutTarget(rawTarget = "") {
  const normalized = `${rawTarget || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (normalized === "all" || normalized === "todos" || normalized === "todas") {
    return "all";
  }

  for (const [id, config] of Object.entries(DISPLAY_BLACKOUT_TARGETS)) {
    if (id === normalized || config.aliases.includes(normalized)) {
      return id;
    }
  }

  return null;
}

export function displayBlackoutIsActive(displayBlackout, target) {
  return Boolean(displayBlackout?.targets?.[target]);
}

export function publicDisplayBlackoutSnapshot(displayBlackout = createInitialDisplayBlackoutState()) {
  const targets = Object.fromEntries(TARGET_IDS.map((target) => [
    target,
    Boolean(displayBlackout.targets?.[target])
  ]));

  return {
    targets,
    updatedAt: displayBlackout.updatedAt || null,
    updatedBy: displayBlackout.updatedBy || null,
    sequence: Number(displayBlackout.sequence || 0)
  };
}

export function displayBlackoutTargetIds() {
  return [...TARGET_IDS];
}
