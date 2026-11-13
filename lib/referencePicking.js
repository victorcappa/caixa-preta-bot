export function isReferenceTargetVisible(target) {
  for (let node = target; node; node = node.parent) if (!node.visible) return false;
  return true;
}

export function pickReferenceTarget(raycaster, targets, viewportHeight, pixelTolerance = 8) {
  raycaster.params.ReferenceFragments = { viewportHeight, pixelTolerance };
  const hits = raycaster.intersectObjects(targets.filter(isReferenceTargetVisible), false);
  const geometry = hits.filter(hit => !hit.object.isSprite);
  geometry.sort((a, b) => (a.pixelDistance || 0) - (b.pixelDistance || 0) || a.distance - b.distance);
  return geometry[0]?.object || hits.find(hit => hit.object.isSprite)?.object;
}
