import fs from "node:fs";
import path from "node:path";

const VIDEO_DIR = path.join(process.cwd(), "assets", "videos", "verdade-ou-bolo");
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm"]);

const ROUND_FILES = [
  "bolo-lanterna.mp4",
  "bolo-papel-higienico.mp4",
  "verdade-nutella.mp4"
];

function answerFromFile(file) {
  if (file.startsWith("bolo-")) return "bolo";
  if (file.startsWith("verdade-")) return "verdade";
  throw new Error(`Video do Verdade ou Bolo sem resposta no titulo: ${file}`);
}

const configuredRounds = ROUND_FILES.map((file, index) => ({
  id: index + 1,
  title: "VERDADE OU BOLO?",
  file,
  correctAnswer: answerFromFile(file)
}));

export const verdadeOuBoloConfig = {
  id: "verdade_ou_bolo",
  requestSlug: "verdade-ou-bolo",
  title: "VERDADE OU BOLO?",
  videoDir: VIDEO_DIR,
  sounds: {
    win: null,
    lose: null
  },
  finalMessages: {
    3: "PERFEITO. SUSPEITO.",
    2: "ACEITAVEL PARA HUMANOS.",
    1: "VOCES CONFIAM DEMAIS NOS OLHOS.",
    0: "PARABENS. TREINARAM A MAQUINA AO CONTRARIO."
  },
  rounds: configuredRounds
};

function discoverVideoFiles() {
  const allowedFiles = new Set(ROUND_FILES);

  try {
    return fs.readdirSync(VIDEO_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && allowedFiles.has(entry.name) && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  } catch {
    return [];
  }
}

function assetUrl(relativePath) {
  if (!relativePath) {
    return null;
  }

  return `/api/game-assets?file=${encodeURIComponent(relativePath)}`;
}

function soundSnapshot(relativePath) {
  return relativePath
    ? {
      path: relativePath,
      src: assetUrl(relativePath)
    }
    : null;
}

export function getVerdadeOuBoloRuntimeConfig() {
  const discovered = discoverVideoFiles();
  const rounds = verdadeOuBoloConfig.rounds.map((round, index) => {
    const file = round.file || discovered[index] || null;
    const relativePath = file ? `videos/verdade-ou-bolo/${file}` : null;

    return {
      ...round,
      video: relativePath
        ? {
          file,
          path: relativePath,
          src: assetUrl(relativePath),
          missing: false
        }
        : {
          file: null,
          path: null,
          src: null,
          missing: true
        }
    };
  });

  return {
    id: verdadeOuBoloConfig.id,
    title: verdadeOuBoloConfig.title,
    requestSlug: verdadeOuBoloConfig.requestSlug,
    videoDir: verdadeOuBoloConfig.videoDir,
    rounds,
    sounds: {
      win: soundSnapshot(verdadeOuBoloConfig.sounds.win),
      lose: soundSnapshot(verdadeOuBoloConfig.sounds.lose)
    },
    finalMessages: { ...verdadeOuBoloConfig.finalMessages },
    discoveredVideos: discovered
  };
}
