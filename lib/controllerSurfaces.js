export const controllerSurfaceGroups = [
  {
    id: "cena-0",
    label: "CENA 0",
    name: "BOT / MALAS",
    order: 0
  },
  {
    id: "cena-1",
    label: "CENA 1",
    name: "QUEDA / EMERGÊNCIA",
    order: 1
  },
  {
    id: "cena-2",
    label: "CENA 2",
    name: "FORÇA G / BARALHO / TRANSIÇÕES",
    order: 2
  },
  {
    id: "cena-3",
    label: "CENA 3",
    name: "TEA FOR TWO / TRANSIÇÃO",
    order: 3
  },
  {
    id: "cena-4",
    label: "CENA 4",
    name: "PILOTO / VIDEOGAME",
    order: 4
  },
  {
    id: "camadas",
    label: "CAMADAS",
    name: "TECNOLOGIA × FLORESTA",
    order: 5
  },
  {
    id: "outros",
    label: "OUTROS",
    name: "UTILITÁRIOS",
    order: 6
  }
];

export const controllerSurfaces = [
  {
    id: "bot-malas",
    name: "CENA 0 — BOT / MALAS",
    shortName: "Bot / Malas",
    label: "Bot / Malas",
    path: "/operator",
    controller: "OperatorConsole",
    aliases: [],
    projectionPath: "/",
    autoNavigateProjection: false,
    groupId: "cena-0",
    order: 0
  },
  {
    id: "queda-emergencia",
    name: "CENA 1 — QUEDA / EMERGÊNCIA",
    shortName: "Queda / Emergência",
    label: "Queda / Emergência",
    path: "/queda-aviao-controller",
    controller: "QuedaAviaoController",
    aliases: ["/queda-aviao/debug"],
    projectionPath: "/queda-aviao",
    groupId: "cena-1",
    order: 0
  },
  {
    id: "forca-g-samples",
    name: "CENA 2A — FORÇA G / SAMPLES AUDIOVISUAIS",
    shortName: "Força G — Samples",
    label: "Força G — Samples",
    path: "/forca-g-samples-controller",
    controller: "PreparedSceneController",
    aliases: [],
    groupId: "cena-2",
    order: 0
  },
  {
    id: "forca-g-shaders",
    name: "CENA 2B — FORÇA G / VÍDEOS E SHADERS",
    shortName: "Força G — Shaders",
    label: "Força G — Shaders",
    path: "/forca-g-shaders-controller",
    controller: "PreparedSceneController",
    aliases: [],
    groupId: "cena-2",
    order: 1
  },
  {
    id: "baralho-morbido",
    name: "CENA 2C — BARALHO MÓRBIDO",
    shortName: "Baralho Mórbido",
    label: "Baralho Mórbido",
    path: "/baralho-morbido-controller",
    controller: "BaralhoMorbidoController",
    aliases: [],
    projectionPath: "/baralho-morbido",
    groupId: "cena-2",
    order: 2
  },
  {
    id: "transicao-psicodelica",
    name: "CENA 2D — TRANSIÇÃO PSICODÉLICA",
    shortName: "Transição Psicodélica",
    label: "Transição Psicodélica",
    path: "/transicao-psicodelica-controller",
    controller: "PreparedSceneController",
    aliases: [],
    groupId: "cena-2",
    order: 3
  },
  {
    id: "tea-for-two",
    name: "CENA 3 — TEA FOR TWO / TRANSIÇÃO",
    shortName: "Tea For Two",
    label: "Tea For Two",
    path: "/tea-for-two-controller",
    controller: "PreparedSceneController",
    aliases: [],
    groupId: "cena-3",
    order: 0
  },
  {
    id: "piloto-videogame",
    name: "CENA 4 — PILOTO / SONS DE VIDEOGAME",
    shortName: "Piloto / Videogame",
    label: "Piloto / Videogame",
    path: "/piloto-videogame-controller",
    controller: "PreparedSceneController",
    aliases: [],
    groupId: "cena-4",
    order: 0
  },
  {
    id: "tecnologia-floresta",
    name: "CAMADA — TECNOLOGIA × FLORESTA",
    shortName: "Tecnologia × Floresta",
    label: "Tecnologia × Floresta",
    path: "/tecnologia-floresta-controller",
    controller: "PreparedSceneController",
    aliases: [],
    projectionPath: "/tecnologia-floresta",
    groupId: "camadas",
    order: 0
  },
  {
    id: "glitch",
    name: "GLITCH GERAL",
    shortName: "Glitch Geral",
    label: "Glitch Geral",
    path: "/glitch-controller",
    controller: "GlitchController",
    aliases: [],
    groupId: "outros",
    order: 0
  },
  {
    id: "treino",
    name: "TREINO",
    shortName: "Treino",
    label: "Treino",
    path: "/treino",
    controller: "TrainingConsole",
    aliases: [],
    groupId: "outros",
    order: 1
  }
];

export const sortedControllerSurfaces = [...controllerSurfaces].sort((a, b) => {
  const groupA = controllerSurfaceGroups.find((group) => group.id === a.groupId)?.order ?? 999;
  const groupB = controllerSurfaceGroups.find((group) => group.id === b.groupId)?.order ?? 999;

  if (groupA !== groupB) {
    return groupA - groupB;
  }

  return (a.order ?? 0) - (b.order ?? 0);
});

export function isControllerSurfaceActive(surface, pathname = "") {
  return surface.path === pathname || surface.aliases?.includes(pathname);
}

export function getControllerSurfaceGroups() {
  return controllerSurfaceGroups
    .map((group) => ({
      ...group,
      surfaces: sortedControllerSurfaces.filter((surface) => surface.groupId === group.id)
    }))
    .filter((group) => group.surfaces.length > 0);
}
