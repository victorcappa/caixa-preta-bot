import fs from "node:fs";
import path from "node:path";

const VIDEO_DIR = path.join(process.cwd(), "assets", "videos", "verdade-ou-bolo");
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm"]);

const configuredRounds = [
  {
    id: 1,
    title: "VERDADE OU BOLO?",
    file: null,
    correctAnswer: "verdade"
  },
  {
    id: 2,
    title: "VERDADE OU BOLO?",
    file: null,
    correctAnswer: "bolo"
  },
  {
    id: 3,
    title: "VERDADE OU BOLO?",
    file: null,
    correctAnswer: "verdade"
  },
  {
    id: 4,
    title: "VERDADE OU BOLO?",
    file: null,
    correctAnswer: "bolo"
  }
];

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
    4: "PERFEITO. SUSPEITO.",
    3: "ACEITAVEL PARA HUMANOS.",
    2: "ESTATISTICAMENTE MEDIOCRE.",
    1: "VOCES CONFIAM DEMAIS NOS OLHOS.",
    0: "PARABENS. TREINARAM A MAQUINA AO CONTRARIO."
  },
  rounds: configuredRounds
};

function discoverVideoFiles() {
  try {
    return fs.readdirSync(VIDEO_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
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
