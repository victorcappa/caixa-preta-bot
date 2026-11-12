export const CONTROLLER_SETTINGS_DEFAULTS = {
  "model-3d": { preset: "draft", removeBackground: false },
  "scene-zero-video": { file: "", loop: false, transitionMs: 5200 },
  "glitch-video": { file: "painel-aeroporto.mp4", loop: false },
  "tarot-preview": { cardId: 16, mode: "associative" }
};
export function normalizeControllerSettings(scope, value = {}) {
  const defaults = CONTROLLER_SETTINGS_DEFAULTS[scope];
  if (!Object.hasOwn(CONTROLLER_SETTINGS_DEFAULTS, scope)) throw new Error("CONTROLLER_SETTINGS_UNKNOWN");
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
    const selected = value?.[key];
    if (key === "preset") return [key, ["draft", "standard", "high"].includes(selected) ? selected : fallback];
    if (key === "mode") return [key, ["normal", "associative", "hallucinatory"].includes(selected) ? selected : fallback];
    if (key === "cardId") return [key, Number.isInteger(selected) ? Math.max(0, Math.min(21, selected)) : fallback];
    if (key === "transitionMs") return [key, Number.isFinite(selected) ? Math.max(0, Math.min(20000, Math.round(selected))) : fallback];
    if (typeof fallback === "boolean") return [key, typeof selected === "boolean" ? selected : fallback];
    return [key, typeof selected === "string" && selected.length <= 500 && !selected.includes("..") ? selected : fallback];
  }));
}
