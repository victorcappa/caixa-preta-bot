export const controllerSurfaces = [
  {
    id: "operator",
    label: "Operator",
    path: "/operator",
    aliases: []
  },
  {
    id: "baralho-morbido",
    label: "Baralho",
    path: "/baralho-morbido-controller",
    aliases: []
  },
  {
    id: "queda-aviao",
    label: "Queda Aviao",
    path: "/queda-aviao-controller",
    aliases: ["/queda-aviao/debug"]
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
