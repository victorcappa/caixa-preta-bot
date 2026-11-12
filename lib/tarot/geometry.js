// All anchors live in the normalized coordinates of the actual reference photo.
export function projectPoint(matrix, x, y) {
  const denominator = matrix[6] * x + matrix[7] * y + matrix[8];
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-8) return null;
  const point = [(matrix[0] * x + matrix[1] * y + matrix[2]) / denominator,
    (matrix[3] * x + matrix[4] * y + matrix[5]) / denominator];
  return point.every(Number.isFinite) ? point : null;
}

export function regionPoints(region, shape = "box") {
  const [x, y, w, h] = region;
  if (shape === "circle") return Array.from({ length: 32 }, (_, i) => {
    const angle = i * Math.PI / 16;
    return [x + w / 2 + Math.cos(angle) * w / 2, y + h / 2 + Math.sin(angle) * h / 2];
  });
  if (shape === "underline") return [[x, y + h], [x + w, y + h]];
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

export function validQuad(points, width, height) {
  if (points.length !== 4 || points.some((p) => !p || !p.every(Number.isFinite))) return false;
  const cross = points.map((a, i) => {
    const b = points[(i + 1) % 4], c = points[(i + 2) % 4];
    return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
  });
  if (!cross.every((c) => c > 0)) return false;
  const area = Math.abs(points.reduce((sum, p, i) => {
    const q = points[(i + 1) % 4];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0)) / 2;
  return area > width * height * 0.015 && area < width * height * 1.5 &&
    points.every(([x, y]) => x > -width * 0.5 && y > -height * 0.5 && x < width * 1.5 && y < height * 1.5);
}

// Segment positions are explicit; legacy scripted lines retain the old separators.
export function elementRevealEvents(segments=[]) {
  const seen=new Set(),events=[];let offset=0;
  for(const segment of segments){
    const start=Number.isFinite(segment.start)?segment.start:offset;
    const fresh=(segment.elementIds||[]).filter((id)=>!seen.has(id));
    fresh.forEach((elementId,i)=>{seen.add(elementId);events.push({elementId,at:start+Math.floor(i*Math.min(28,segment.text.length/Math.max(1,fresh.length)))});});
    offset=start+segment.text.length+2;
  }
  return events;
}
export function visibleElementIds(segments=[],length=0){return elementRevealEvents(segments).filter((e)=>length>e.at).map((e)=>e.elementId);}
export function activeElementIds(segments=[],length=0){
  let offset=0,active=[];
  for(const segment of segments){const start=Number.isFinite(segment.start)?segment.start:offset;if(length<=start)break;active=segment.elementIds||[];offset=start+segment.text.length+2;}
  return active.filter((id)=>visibleElementIds(segments,length).includes(id));
}

// The same 'contain' transform used by video/SVG, including letterbox offsets.
export function videoQuadInStage(points, width, height, stageWidth, stageHeight) {
  if (!width || !height || !stageWidth || !stageHeight || points.some((p)=>!p)) return null;
  const scale = Math.min(stageWidth / width, stageHeight / height);
  const left = (stageWidth - width * scale) / 2, top = (stageHeight - height * scale) / 2;
  return points.map(([x,y])=>[(left+x*scale)/stageWidth*100,(top+y*scale)/stageHeight*100]);
}
