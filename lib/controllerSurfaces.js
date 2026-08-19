export const controllerSurfaces = [
  {
    id: "chatbot",
    label: "Chatbot",
    path: "/operator",
    aliases: [],
    projectionPath: "/"
  },
  {
    id: "baralho-morbido",
    label: "Baralho",
    path: "/baralho-morbido-controller",
    aliases: [],
    projectionPath: "/baralho-morbido"
  },
  {
    id: "queda-aviao",
    label: "Queda Aviao",
    path: "/queda-aviao-controller",
    aliases: ["/queda-aviao/debug"],
    projectionPath: "/queda-aviao"
  },
  {
    id: "glitch",
    label: "Glitch",
    path: "/glitch-controller",
    aliases: []
  },
  {
    id: "treino",
    label: "Treino",
    path: "/treino",
    aliases: []
  }
];

export function isControllerSurfaceActive(surface, pathname = "") {
  return surface.path === pathname || surface.aliases?.includes(pathname);
}
