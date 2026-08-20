import fs from "node:fs";
import path from "node:path";
import { normalizeSceneAudioEffects } from "@/lib/sceneAudioEffects";

const DATA_PATH = path.join(process.cwd(), "data", "controller-cues.json");
const ASSETS_ROOT = path.join(process.cwd(), "assets");
const UPLOAD_ROOT = path.join(ASSETS_ROOT, "controller-cues");

const MEDIA_EXTENSIONS = {
  audio: new Set([".mp3", ".wav", ".ogg", ".m4a"]),
  video: new Set([".mp4", ".m4v", ".mov", ".webm"]),
  image: new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"])
};

const CUE_COLORS = ["#00ff66", "#70f4ff", "#ffd760", "#ff477d", "#ffffff", "#b58cff"];
const SCENE_ONE_AUDIO_DIRECTORY = "audios/queda-aviao";

export const EDITABLE_CUE_CONTROLLERS = {
  "queda-aviao-sampler": {
    id: "queda-aviao-sampler",
    title: "SAMPLER — QUEDA / EMERGÊNCIA",
    description: "Samples manuais e independentes do texto da Cena 1. Cadastre os arquivos, loops, volumes e atalhos aqui.",
    allowedTypes: ["audio"],
    uploadTypes: ["audio"],
    cues: sceneOneAudioCues()
  },
  "forca-g-samples": {
    id: "forca-g-samples",
    title: "CENA 2A — FORÇA G / SAMPLES AUDIOVISUAIS",
    description: "Botões editáveis para vídeos, imagens, sons, deepfakes e inserts. Atalhos não disparam enquanto você digita.",
    allowedTypes: ["video", "image", "audio"],
    uploadTypes: ["audio", "video", "image"],
    cues: [
      cue("Força G Isabela", "1", "video", "videos/forca-g/forca-g-isabela.mp4", 0, "#70f4ff"),
      cue("Força G Robinson", "2", "video", "videos/forca-g/forca-g-robinson.mp4", 0, "#ffd760"),
      cue("Força G Ney", "3", "video", "videos/forca-g/forca-g-ney.mp4", 0, "#ff477d"),
      cue("Impacto Curto", "a", "audio", "", 2500, "#00ff66")
    ]
  },
  "forca-g-shaders": {
    id: "forca-g-shaders",
    title: "CENA 2B — FORÇA G / VÍDEOS E SHADERS",
    description: "Vídeos, imagens, deepfakes e sons editáveis para a camada visual da Força G.",
    allowedTypes: ["video", "image", "audio"],
    uploadTypes: ["audio", "video", "image"],
    cues: [
      cue("Vídeo Principal", "1", "video", "", 0, "#70f4ff"),
      cue("Deepfake", "2", "video", "", 0, "#b58cff"),
      cue("Insert Visual", "3", "image", "", 5000, "#ffd760")
    ]
  },
  "transicao-psicodelica": {
    id: "transicao-psicodelica",
    title: "CENA 2D — TRANSIÇÃO PSICODÉLICA",
    description: "Texto subindo, áudios, vídeos e imagens editáveis para a transição psicodélica.",
    allowedTypes: ["text", "audio", "video", "image"],
    uploadTypes: ["audio", "video", "image"],
    cues: [
      cue("Texto Subindo", "1", "text", "", 15000, "#ffffff", "O CORPO CONTINUA SUBINDO\nMESMO QUANDO A TELA APAGA"),
      cue("Áudio Processado", "2", "audio", "audios/CENA 2 FIM/AUDIO-2026-08-19-19-12-26.m4a", 0, "#70f4ff"),
      cue("Segundo Áudio", "3", "audio", "audios/CENA 2 FIM/AUDIO-2026-08-19-19-12-17.m4a", 0, "#ff477d")
    ]
  },
  "tea-for-two": {
    id: "tea-for-two",
    title: "CENA 3 — TEA FOR TWO / TRANSIÇÃO",
    description: "Músicas e sons editáveis da transição Tea For Two.",
    allowedTypes: ["audio"],
    uploadTypes: ["audio"],
    cues: [
      cue("Tea For Two", "1", "audio", "audios/Doris Day - Tea For Two (1950).mp3", 0, "#ffd760")
    ]
  },
  "piloto-videogame": {
    id: "piloto-videogame",
    title: "CENA 4 — PILOTO / SONS DE VIDEOGAME",
    description: "Soundboard editável da rotina do piloto, com atalhos configuráveis e arquivos de áudio persistentes.",
    allowedTypes: ["audio"],
    uploadTypes: ["audio"],
    cues: [
      cue("Confirmar Comando", "1", "audio", "", 0, "#00ff66"),
      cue("Erro Arcade", "2", "audio", "", 0, "#ff477d"),
      cue("Power Up", "3", "audio", "", 0, "#ffd760"),
      cue("Game Over", "4", "audio", "", 0, "#ffffff")
    ]
  },
  "tecnologia-floresta": {
    id: "tecnologia-floresta",
    title: "CAMADA — TECNOLOGIA × FLORESTA",
    description: "Banco editável de áudios, loops e crossfades. A projeção pública desta camada abre escura por enquanto.",
    allowedTypes: ["audio"],
    uploadTypes: ["audio"],
    cues: [
      cue("Máquina Baixa", "q", "audio", "", 0, "#70f4ff"),
      cue("Folha / Ruído", "w", "audio", "", 0, "#00ff66"),
      cue("Pulso Digital", "e", "audio", "", 0, "#b58cff"),
      cue("Loop Híbrido", "r", "audio", "", 0, "#ffd760")
    ]
  }
};

function cue(label, shortcut, type, assetPath, durationMs, color, text = "") {
  return {
    id: crypto.randomUUID(),
    label,
    shortcut,
    type,
    assetPath,
    durationMs,
    color,
    text
  };
}

function sceneOneAudioCues() {
  const directory = path.join(ASSETS_ROOT, ...SCENE_ONE_AUDIO_DIRECTORY.split("/"));

  try {
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && MEDIA_EXTENSIONS.audio.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }))
      .map((filename, index) => cue(
        path.basename(filename, path.extname(filename)),
        "",
        "audio",
        `${SCENE_ONE_AUDIO_DIRECTORY}/${filename}`,
        0,
        CUE_COLORS[index % CUE_COLORS.length]
      ));
  } catch {
    return [];
  }
}

export function getCueColors() {
  return [...CUE_COLORS];
}

export function listControllerAssets() {
  const assets = {
    audio: [],
    video: [],
    image: []
  };

  walkAssets(ASSETS_ROOT, (absolute) => {
    const extension = path.extname(absolute).toLowerCase();
    const relativePath = path.relative(ASSETS_ROOT, absolute).split(path.sep).join("/");

    for (const [type, extensions] of Object.entries(MEDIA_EXTENSIONS)) {
      if (extensions.has(extension)) {
        assets[type].push({
          path: relativePath,
          name: path.basename(relativePath),
          src: `/api/game-assets?file=${encodeURIComponent(relativePath)}`
        });
      }
    }
  });

  for (const type of Object.keys(assets)) {
    assets[type].sort((a, b) => a.path.localeCompare(b.path));
  }

  return assets;
}

export function readControllerCueStore() {
  const defaults = Object.fromEntries(
    Object.entries(EDITABLE_CUE_CONTROLLERS).map(([id, config]) => [id, normalizeControllerCueConfig(id, config)])
  );

  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    const controllers = parsed.controllers || {};

    return {
      controllers: Object.fromEntries(
        Object.entries(defaults).map(([id, config]) => [
          id,
          normalizeControllerCueConfig(id, {
            ...config,
            ...(controllers[id] || {})
          })
        ])
      )
    };
  } catch {
    return { controllers: defaults };
  }
}

export function readControllerCueConfig(controllerId) {
  const store = readControllerCueStore();
  return store.controllers[controllerId] || null;
}

export function saveControllerCueConfig(controllerId, config) {
  if (!EDITABLE_CUE_CONTROLLERS[controllerId]) {
    return null;
  }

  const store = readControllerCueStore();
  store.controllers[controllerId] = normalizeControllerCueConfig(controllerId, {
    ...store.controllers[controllerId],
    ...(config || {})
  });

  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, `${JSON.stringify(store, null, 2)}\n`);

  return store.controllers[controllerId];
}

export async function saveControllerCueUpload(controllerId, file) {
  const controller = EDITABLE_CUE_CONTROLLERS[controllerId];

  if (!controller || !file?.name) {
    return null;
  }

  const extension = path.extname(file.name).toLowerCase();
  const accepted = controller.uploadTypes.some((type) => MEDIA_EXTENSIONS[type]?.has(extension));

  if (!accepted) {
    return null;
  }

  const safeName = file.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const uploadDir = path.join(UPLOAD_ROOT, controllerId);
  const destination = uniquePath(path.join(uploadDir, safeName || `asset${extension}`));

  fs.mkdirSync(uploadDir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(destination, bytes);

  const relativePath = path.relative(ASSETS_ROOT, destination).split(path.sep).join("/");
  return {
    path: relativePath,
    name: path.basename(relativePath),
    src: `/api/game-assets?file=${encodeURIComponent(relativePath)}`
  };
}

function normalizeControllerCueConfig(controllerId, config) {
  const defaults = EDITABLE_CUE_CONTROLLERS[controllerId] || {};
  const allowedTypes = Array.isArray(defaults.allowedTypes) ? defaults.allowedTypes : ["audio"];

  return {
    id: controllerId,
    title: `${config.title || defaults.title || controllerId}`.trim(),
    description: `${config.description || defaults.description || ""}`.trim(),
    allowedTypes,
    uploadTypes: Array.isArray(defaults.uploadTypes) ? defaults.uploadTypes : allowedTypes,
    cues: Array.isArray(config.cues)
      ? config.cues.map((item) => normalizeCue(item, allowedTypes)).filter(Boolean)
      : []
  };
}

function normalizeCue(item, allowedTypes) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const type = allowedTypes.includes(item.type) ? item.type : allowedTypes[0];
  const color = /^#[0-9a-fA-F]{6}$/.test(`${item.color || ""}`) ? item.color : CUE_COLORS[0];

  return {
    id: `${item.id || crypto.randomUUID()}`,
    label: `${item.label || "Novo Botão"}`.trim() || "Novo Botão",
    shortcut: `${item.shortcut || ""}`.trim().slice(0, 24),
    type,
    assetPath: `${item.assetPath || ""}`.trim(),
    durationMs: Math.max(0, Math.min(Number(item.durationMs) || 0, 60 * 60 * 1000)),
    loop: Boolean(item.loop),
    volume: Math.max(0, Math.min(1, Number.isFinite(Number(item.volume)) ? Number(item.volume) : 1)),
    ...(type === "audio" ? { audioEffects: normalizeSceneAudioEffects(item.audioEffects) } : {}),
    color,
    text: `${item.text || ""}`.slice(0, 12000)
  };
}

function walkAssets(dir, visit) {
  if (!fs.existsSync(dir)) {
    return;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolute = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkAssets(absolute, visit);
    } else if (entry.isFile()) {
      visit(absolute);
    }
  }
}

function uniquePath(candidate) {
  if (!fs.existsSync(candidate)) {
    return candidate;
  }

  const extension = path.extname(candidate);
  const basename = path.basename(candidate, extension);
  const dirname = path.dirname(candidate);
  let index = 2;

  while (fs.existsSync(path.join(dirname, `${basename}-${index}${extension}`))) {
    index += 1;
  }

  return path.join(dirname, `${basename}-${index}${extension}`);
}
