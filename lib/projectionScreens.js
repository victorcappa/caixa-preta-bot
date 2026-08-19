export const PROJECTION_WINDOW_PARAM = "projectionWindow";

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
    return new URL(value, "http://caixa-preta.local").pathname;
  } catch {
    return "";
  }
}

export function isProjectionPath(path = "") {
  return Boolean(getProjectionScreenByPath(path));
}
