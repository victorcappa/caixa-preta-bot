const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const validId = value => typeof value === "string" && value.trim() ? value.trim() : null;
const compareIds = (left, right) => left < right ? -1 : left > right ? 1 : 0;

// Elect one typewriter source; audio relay still chooses the output device/window.
export function selectPostDemoAudioSource(projection) {
  if (!isRecord(projection) || !isRecord(projection.windows)) return null;
  const candidates = [];
  for (const [key, window] of Object.entries(projection.windows)) {
    if (!isRecord(window) || window.connected !== true || typeof window.currentPath !== "string") continue;
    const path = window.currentPath.split(/[?#]/u)[0];
    if (path !== "/pos-demo" && path !== "/pos-demo/controle") continue;
    const id = validId(window.id) || validId(key);
    if (id) candidates.push({ id, key, controller: path === "/pos-demo/controle" });
  }
  const publicSources = candidates.filter(candidate => !candidate.controller);
  const eligible = (publicSources.length ? publicSources : candidates)
    .sort((left, right) => compareIds(left.id, right.id) || compareIds(left.key, right.key));
  const activeId = validId(projection.activeProjectionWindowId);
  const selected = eligible.find(candidate => candidate.id === activeId)
    || eligible.find(candidate => candidate.key === activeId) || eligible[0];
  return selected ? { id: selected.id, controller: selected.controller } : null;
}
