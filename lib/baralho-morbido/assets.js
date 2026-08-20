import fs from "node:fs";
import path from "node:path";
import {
  BARALHO_MORBIDO_VIDEO_DIRECTORY,
  BARALHO_MORBIDO_VIDEO_EXTENSIONS,
  createBaralhoMorbidoCards
} from "./config.js";

export function loadBaralhoMorbidoCards() {
  const directory = path.join(process.cwd(), "assets", BARALHO_MORBIDO_VIDEO_DIRECTORY);

  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && BARALHO_MORBIDO_VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "pt-BR", { numeric: true, sensitivity: "base" }));

  return createBaralhoMorbidoCards(files);
}
