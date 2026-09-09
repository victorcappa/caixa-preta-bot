export function resolveEmbeddedPanelVisible(currentInstagram = {}, nextInstagram = {}) {
  if (Object.hasOwn(nextInstagram, "embeddedPanelVisible")) {
    return Boolean(nextInstagram.embeddedPanelVisible);
  }

  const previousSequence = Number(currentInstagram.embeddedPanelSequence) || 0;
  const nextSequence = Number(nextInstagram.embeddedPanelSequence) || previousSequence;
  if (nextSequence > previousSequence) return true;

  return Boolean(currentInstagram.embeddedPanelVisible);
}
