export function decodePointCloud(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 16 || view.getUint32(0, false) !== 0x43505043 || view.getUint32(4, true) !== 1 || view.getUint32(12, true) !== 15) throw Error("POINT_CLOUD_INVALID");
  const count = view.getUint32(8, true);
  if (count < 1 || count > 400000 || view.byteLength !== 16 + count * 15) throw Error("POINT_CLOUD_INVALID");
  const positions = new Float32Array(count * 3), colors = new Uint8Array(count * 3);
  let pivot = 0;
  for (let i = 0; i < count; i++) {
    const offset = 16 + i * 15, x = view.getFloat32(offset, true), y = view.getFloat32(offset + 4, true), z = view.getFloat32(offset + 8, true);
    if (![x, y, z].every(Number.isFinite) || z <= 0 || z > 100 || Math.abs(x) > 100 || Math.abs(y) > 100) throw Error("POINT_CLOUD_INVALID");
    positions.set([x, y, z], i * 3); colors.set([view.getUint8(offset + 12), view.getUint8(offset + 13), view.getUint8(offset + 14)], i * 3); pivot += z;
  }
  pivot /= count;
  for (let i = 0; i < count; i++) positions[i * 3 + 2] = pivot - positions[i * 3 + 2];
  return { positions, colors, count };
}
