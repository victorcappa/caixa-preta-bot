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
    menuLabel: "Bot",
    label: "Bot / Malas",
    sceneNumber: "CENA 0",
    path: "/operator",
    controller: "OperatorConsole",
    aliases: [],
    projectionPath: "/",
    groupId: "cena-0",
    order: 0
  },
  {
    id: "queda-emergencia",
    name: "CENA 1 — QUEDA / EMERGÊNCIA",
    shortName: "Queda / Emergência",
    menuLabel: "Queda",
    label: "Queda / Emergência",
    sceneNumber: "CENA 1",
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
    menuLabel: "Sampler Força G",
    label: "Força G — Samples",
    sceneNumber: "CENA 2A",
    path: "/forca-g-samples-controller",
    controller: "EditableCueController",
    aliases: [],
    projectionPath: "/forca-g-samples",
    groupId: "cena-2",
    order: 0
  },
  {
    id: "forca-g-shaders",
    name: "CENA 2B — FORÇA G / VÍDEOS E SHADERS",
    shortName: "Força G — Shaders",
    menuLabel: "Shaders",
    label: "Força G — Shaders",
    sceneNumber: "CENA 2B",
    path: "/forca-g-shaders-controller",
    controller: "EditableCueController",
    aliases: [],
    projectionPath: "/forca-g-shaders",
    groupId: "cena-2",
    order: 1
  },
  {
    id: "baralho-morbido",
    name: "CENA 2C — BARALHO MÓRBIDO",
    shortName: "Baralho Mórbido",
    menuLabel: "Baralho",
    label: "Baralho Mórbido",
    sceneNumber: "CENA 2C",
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
    menuLabel: "Psicodélica",
    label: "Transição Psicodélica",
    path: "/transicao-psicodelica-controller",
    controller: "EditableCueController",
    aliases: [],
    sceneNumber: "CENA 2D",
    projectionPath: "/transicao-psicodelica",
    groupId: "cena-2",
    order: 3
  },
  {
    id: "tea-for-two",
    name: "CENA 3 — TEA FOR TWO / TRANSIÇÃO",
    shortName: "Tea For Two",
    menuLabel: "Tea For Two",
    label: "Tea For Two",
    path: "/tea-for-two-controller",
    controller: "EditableCueController",
    aliases: [],
    sceneNumber: "CENA 3",
    projectionPath: "/tea-for-two",
    groupId: "cena-3",
    order: 0
  },
  {
    id: "piloto-videogame",
    name: "CENA 4 — PILOTO / SONS DE VIDEOGAME",
    shortName: "Piloto / Videogame",
    menuLabel: "Piloto",
    label: "Piloto / Videogame",
    sceneNumber: "CENA 4",
    path: "/piloto-videogame-controller",
    controller: "EditableCueController",
    aliases: [],
    projectionPath: "/piloto-videogame",
    groupId: "cena-4",
    order: 0
  },
  {
    id: "tecnologia-floresta",
    name: "CAMADA — TECNOLOGIA × FLORESTA",
    shortName: "Tecnologia × Floresta",
    menuLabel: "Tec. / Floresta",
    label: "Tecnologia × Floresta",
    sceneNumber: "CAMADA",
    path: "/tecnologia-floresta-controller",
    controller: "EditableCueController",
    aliases: [],
    projectionPath: "/tecnologia-floresta",
    groupId: "camadas",
    order: 0
  },
  {
    id: "glitch",
    name: "GLITCH GERAL",
    shortName: "Glitch Geral",
    menuLabel: "Glitch",
    label: "Glitch Geral",
    sceneNumber: "OUTROS",
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
    menuLabel: "Treino",
    label: "Treino",
    sceneNumber: "OUTROS",
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
