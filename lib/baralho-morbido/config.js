export const BARALHO_MORBIDO_VIDEO_DIRECTORY = "videos/baralho-morbido";

export const BARALHO_MORBIDO_VIDEO_EXTENSIONS = new Set([
  ".m4v",
  ".mov",
  ".mp4",
  ".webm"
]);

export function createBaralhoMorbidoCard(file) {
  const normalizedFile = `${file || ""}`.trim();
  const extensionIndex = normalizedFile.lastIndexOf(".");
  const id = extensionIndex > 0
    ? normalizedFile.slice(0, extensionIndex)
    : normalizedFile;
  const assetPath = `${BARALHO_MORBIDO_VIDEO_DIRECTORY}/${normalizedFile}`;

  return {
    id,
    video: {
      file: normalizedFile,
      path: assetPath,
      src: `/api/game-assets?file=${encodeURIComponent(assetPath)}`
    },
    title: `Carta ${id}`,
    text: "",
    category: "acidente",
    metadata: {}
  };
}

export function createBaralhoMorbidoCards(files = []) {
  return files.map(createBaralhoMorbidoCard);
}

export function getBaralhoMorbidoCard(id, cards = []) {
  return cards.find((card) => card.id === id) || null;
}
