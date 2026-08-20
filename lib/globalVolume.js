export const GLOBAL_VOLUME_STORAGE_KEY = "caixa-preta.global-volume";
export const LEGACY_FORCA_G_VOLUME_STORAGE_KEY = "caixa-preta.forca-g-sampler.master-volume";
export const GLOBAL_VOLUME_EVENT = "caixa-preta:global-volume";

export function normalizeGlobalVolume(value, fallback = 1) {
  if (value === null || value === undefined || value === "") return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : fallback;
}

export function readStoredGlobalVolume(fallback = 1) {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(GLOBAL_VOLUME_STORAGE_KEY)
    ?? window.localStorage.getItem(LEGACY_FORCA_G_VOLUME_STORAGE_KEY);
  return normalizeGlobalVolume(stored, fallback);
}

export function publishGlobalVolume(value) {
  const normalized = normalizeGlobalVolume(value);
  if (typeof window === "undefined") return normalized;
  window.localStorage.setItem(GLOBAL_VOLUME_STORAGE_KEY, `${normalized}`);
  window.dispatchEvent(new CustomEvent(GLOBAL_VOLUME_EVENT, { detail: normalized }));
  return normalized;
}
