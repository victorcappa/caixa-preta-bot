export const PROJECTION_WINDOW_PARAM = "projectionWindow";
const PROJECTION_PATH_ALIASES = {
  "/forca-g-shaders": "/forca-g-samples"
};

export const projectionScreens = [
  {
    id: "chatbot",
    label: "Chatbot",
    path: "/"
  },
  {
    id: "baralho-morbido",
    label: "Baralho Morbido",
    path: "/baralho-morbido"
  },
  {
    id: "queda-aviao",
    label: "Queda Aviao",
    path: "/queda-aviao"
  },
  {
    id: "forca-g-samples",
    label: "Forca G Samples",
    path: "/forca-g-samples"
  },
  {
    id: "transicao-psicodelica",
    label: "Transicao Psicodelica",
    path: "/transicao-psicodelica"
  },
  {
    id: "tea-for-two",
    label: "Tea For Two",
    path: "/tea-for-two"
  },
  {
    id: "piloto-videogame",
    label: "Piloto Videogame",
    path: "/piloto-videogame"
  },
  {
    id: "tecnologia-floresta",
    label: "Tecnologia x Floresta",
    path: "/tecnologia-floresta"
  }
];

export function getProjectionScreenByPath(path = "") {
  const pathname = normalizeProjectionPath(path);
  return projectionScreens.find((screen) => screen.path === pathname) || null;
}

export function getProjectionScreenById(id = "") {
  return projectionScreens.find((screen) => screen.id === id) || null;
}

export function normalizeProjectionPath(path = "") {
  const value = `${path || ""}`.trim();

  if (!value.startsWith("/")) {
    return "";
  }

  try {
    const pathname = new URL(value, "http://caixa-preta.local").pathname;
    return PROJECTION_PATH_ALIASES[pathname] || pathname;
  } catch {
    return "";
  }
}

export function isProjectionPath(path = "") {
  return Boolean(getProjectionScreenByPath(path));
}
