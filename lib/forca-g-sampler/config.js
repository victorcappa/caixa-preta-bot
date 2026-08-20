import fs from "node:fs";
import path from "node:path";

const ASSETS_ROOT = path.join(process.cwd(), "assets");
const SAMPLER_ROOT = path.join(ASSETS_ROOT, "sampler-forca-g");
const MANIFEST_PATH = path.join(SAMPLER_ROOT, "manifest.json");
const LEGACY_STORE_PATH = path.join(process.cwd(), "data", "controller-cues.json");

const SECTIONS = {
  gLoc: { directory: "g-loc", type: "video", extensions: [".mp4", ".m4v", ".mov", ".webm"] },
  audio: { directory: "audio", type: "audio", extensions: [".mp3", ".wav", ".m4a", ".ogg"] },
  images: { directory: "images", type: "image", extensions: [".png", ".jpg", ".jpeg", ".webp", ".gif"] },
  video: { directory: "videos", type: "video", extensions: [".mp4", ".m4v", ".mov", ".webm"] },
  texts: { directory: "texts", type: "text", extensions: [".txt"] }
};

const DEFAULT_MANIFEST = {
  version: 1,
  gLoc: [],
  audio: [],
  images: [],
  video: [],
  texts: [],
  presets: []
};

function slug(value = "") {
  return `${value}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function labelFromFilename(filename = "") {
  return path.basename(filename, path.extname(filename)).replace(/[-_]+/g, " ").trim();
}

function safeRelativeAssetPath(value = "", section) {
  const raw = `${value || ""}`.trim().replace(/^\/+/, "");
  if (!raw || raw.includes("..") || path.isAbsolute(raw)) return "";
  if (raw.includes("/")) return raw;
  return `sampler-forca-g/${section.directory}/${raw}`;
}

function assetExists(assetPath = "") {
  if (!assetPath) return false;
  const absolute = path.join(ASSETS_ROOT, ...assetPath.split("/"));
  return absolute.startsWith(ASSETS_ROOT + path.sep) && fs.existsSync(absolute) && fs.statSync(absolute).isFile();
}

function readTextAsset(assetPath = "") {
  try {
    return fs.readFileSync(path.join(ASSETS_ROOT, ...assetPath.split("/")), "utf8").slice(0, 12000).trim();
  } catch {
    return "";
  }
}

function normalizeItem(raw, sectionKey, section, index) {
  if (!raw || typeof raw !== "object") return null;
  const file = safeRelativeAssetPath(raw.file || raw.assetPath, section);
  const derivedLabel = labelFromFilename(file || raw.id || `${sectionKey}-${index + 1}`);
  const id = slug(raw.id || `${sectionKey}-${derivedLabel}`);
  const type = section.type;
  const text = type === "text" ? `${raw.text || (file ? readTextAsset(file) : "")}`.slice(0, 12000) : "";
  const available = type === "text" ? Boolean(text) : assetExists(file);

  return {
    id,
    type,
    category: sectionKey,
    label: `${raw.label || derivedLabel || id}`.trim(),
    assetPath: file,
    text,
    shortcut: `${raw.shortcut || ""}`.trim().slice(0, 24),
    loop: Boolean(raw.loop),
    muted: Boolean(raw.muted),
    volume: Math.max(0, Math.min(1, Number.isFinite(Number(raw.volume)) ? Number(raw.volume) : 1)),
    durationMs: Math.max(0, Math.min(60 * 60 * 1000, Number(raw.durationMs) || 0)),
    fadeInMs: Math.max(0, Math.min(10000, Number(raw.fadeInMs) || 0)),
    fadeOutMs: Math.max(0, Math.min(10000, Number(raw.fadeOutMs) || 0)),
    mode: `${raw.mode || "replace"}`.toLowerCase() === "overlay" ? "overlay" : "replace",
    fit: ["contain", "cover"].includes(raw.fit) ? raw.fit : "contain",
    style: raw.style && typeof raw.style === "object" ? raw.style : {},
    tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 24) : [],
    available
  };
}

function discoverSection(sectionKey, section) {
  const directory = path.join(SAMPLER_ROOT, section.directory);
  try {
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && section.extensions.includes(path.extname(entry.name).toLowerCase()))
      .map((entry, index) => normalizeItem({ file: entry.name }, sectionKey, section, index))
      .filter(Boolean)
      .sort((left, right) => left.label.localeCompare(right.label, "pt-BR", { sensitivity: "base" }));
  } catch {
    return [];
  }
}

function readRawManifest() {
  try {
    return { ...DEFAULT_MANIFEST, ...JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) };
  } catch (error) {
    console.error(`SamplerForcaG: manifest inválido em ${MANIFEST_PATH}`, error);
    return DEFAULT_MANIFEST;
  }
}

function normalizePreset(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  return {
    id: slug(raw.id || raw.label || `preset-${index + 1}`),
    label: `${raw.label || raw.id || `Preset ${index + 1}`}`.trim(),
    shortcut: `${raw.shortcut || ""}`.trim().slice(0, 24),
    actions: Array.isArray(raw.actions) ? raw.actions.filter((action) => action && typeof action === "object").slice(0, 32) : []
  };
}

function readLegacyItems() {
  try {
    const cues = JSON.parse(fs.readFileSync(LEGACY_STORE_PATH, "utf8"))?.controllers?.["forca-g-samples"]?.cues;
    if (!Array.isArray(cues)) return [];
    return cues.filter((cue) => cue?.assetPath || (cue?.type === "text" && cue?.text));
  } catch {
    return [];
  }
}

export function readForcaGSamplerConfig() {
  const manifest = readRawManifest();
  const sections = {};
  const warnings = [];

  for (const [sectionKey, section] of Object.entries(SECTIONS)) {
    const configured = (Array.isArray(manifest[sectionKey]) ? manifest[sectionKey] : [])
      .map((item, index) => normalizeItem(item, sectionKey, section, index))
      .filter(Boolean);
    const configuredPaths = new Set(configured.map((item) => item.assetPath).filter(Boolean));
    const discovered = discoverSection(sectionKey, section).filter((item) => !configuredPaths.has(item.assetPath));
    sections[sectionKey] = [...configured, ...discovered];
  }

  for (const [index, cue] of readLegacyItems().entries()) {
    const sectionKey = cue.type === "audio"
      ? "audio"
      : cue.type === "image"
        ? "images"
        : cue.type === "text"
          ? "texts"
          : `${cue.assetPath || ""}`.startsWith("videos/forca-g/") ? "gLoc" : "video";
    const section = SECTIONS[sectionKey];
    const legacyItem = normalizeItem({ ...cue, file: cue.assetPath }, sectionKey, section, index);
    const alreadyRegistered = Object.values(sections).flat().some((item) => item.assetPath && item.assetPath === legacyItem?.assetPath);
    if (legacyItem && !alreadyRegistered) sections[sectionKey].push(legacyItem);
  }

  for (const item of Object.values(sections).flat()) {
    if (!item.available) {
      const detail = item.assetPath || item.id;
      const warning = `SamplerForcaG: asset não encontrado: assets/${detail}`;
      warnings.push(warning);
      console.error(warning);
    }
  }

  return {
    version: Number(manifest.version) || 1,
    sections,
    presets: (Array.isArray(manifest.presets) ? manifest.presets : []).map(normalizePreset).filter(Boolean),
    warnings
  };
}

export function findForcaGSamplerItem(config, itemId) {
  for (const items of Object.values(config?.sections || {})) {
    const item = items.find((candidate) => candidate.id === itemId);
    if (item) return item;
  }
  return null;
}
