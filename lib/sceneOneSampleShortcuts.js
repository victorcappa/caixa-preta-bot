export const SCENE_ONE_SAMPLE_SHORTCUTS = Object.freeze([
  "q", "w", "e",
  "a", "s", "d",
  "z", "x", "c",
  "r", "t", "y",
  "f", "g", "h",
  "v", "b", "n",
  "u", "i", "o",
  "j", "k", "m", "p"
]);

export function nextSceneOneSampleShortcut(cues = []) {
  const used = new Set(cues.map((cue) => `${cue.shortcut || ""}`.trim().toLowerCase()).filter(Boolean));
  return SCENE_ONE_SAMPLE_SHORTCUTS.find((shortcut) => !used.has(shortcut)) || "";
}

export function assignSceneOneSampleShortcuts(cues = []) {
  const used = new Set(cues
    .map((cue) => `${cue.shortcut || ""}`.trim().toLowerCase())
    .filter((shortcut) => shortcut && shortcut !== "l"));

  return cues.map((cue) => {
    const requested = `${cue.shortcut || ""}`.trim();
    if (requested && requested.toLowerCase() !== "l") return cue;
    const shortcut = SCENE_ONE_SAMPLE_SHORTCUTS.find((candidate) => !used.has(candidate)) || "";
    if (shortcut) used.add(shortcut);
    return { ...cue, shortcut };
  });
}
