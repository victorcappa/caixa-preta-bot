// A surface sampled into colored fragments. The source geometry stays intact.
export function createReferenceFragments(THREE, source, { id, size = 1, count = 1700, fadeSolid = true } = {}) {
  let seed = [...id].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  source.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(source), extent = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), cross = new THREE.Vector3(), edge = new THREE.Vector3();
  const faces = [], materials = new Map(); let total = 0;
  source.traverse(mesh => {
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
    for (const material of [].concat(mesh.material || [])) if (!materials.has(material)) materials.set(material, { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite });
    const geometry = mesh.geometry, position = geometry.attributes.position, index = geometry.index;
    const triangles = Math.floor((index ? index.count : position.count) / 3), stride = Math.max(1, Math.ceil(triangles / 5000));
    for (let triangle = 0; triangle < triangles; triangle += stride) {
      const offset = triangle * 3;
      a.fromBufferAttribute(position, index ? index.getX(offset) : offset).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(position, index ? index.getX(offset + 1) : offset + 1).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(position, index ? index.getX(offset + 2) : offset + 2).applyMatrix4(mesh.matrixWorld);
      const area = cross.subVectors(b, a).cross(edge.subVectors(c, a)).length() * .5;
      if (area > 1e-12) { total += area * stride; faces.push({ mesh, offset, end: total }); }
    }
  });
  if (!faces.length) throw new Error(`No fragmentable surface: ${id}`);
  const object = new THREE.Group(), visual = new THREE.Group(); object.name = `fragments-${id}`;
  const cloudSize = Math.min(size, 1.5);
  object.userData.height = source.userData.height || extent.y; object.add(visual); visual.add(source); source.visible = false;
  const uniforms = { uFragmentTime: { value: 0 }, uAssembly: { value: 0 } };
  const fragmentMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .7, metalness: .2, emissive: '#122b35', emissiveIntensity: .35 });
  fragmentMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'attribute vec4 aFragmentDrift; uniform float uFragmentTime; uniform float uAssembly;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed *= 1. - smoothstep(.68, 1., uAssembly);');
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      float pulse = .85 + .15 * sin(uFragmentTime * 1.35 + aFragmentDrift.w);
      vec3 drift = aFragmentDrift.xyz * (1. - uAssembly) * pulse;
      drift.y += sin(uFragmentTime * .8 + aFragmentDrift.w) * .035 * (1. - uAssembly);
      mvPosition.xyz += (modelViewMatrix * vec4(drift, 0.)).xyz;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  fragmentMaterial.customProgramCacheKey = () => 'reference-fragments-v1';
  const geometry = new THREE.BoxGeometry(1, 1, 1), drifts = new Float32Array(count * 4), homes = new Float32Array(count * 3), radii = new Float32Array(count);
  geometry.setAttribute('aFragmentDrift', new THREE.InstancedBufferAttribute(drifts, 4));
  const particles = new THREE.InstancedMesh(geometry, fragmentMaterial, count); particles.name = 'colored-fragments';
  const dummy = new THREE.Object3D(), color = new THREE.Color(), mist = new THREE.Color('#b9dfe4');
  for (let i = 0; i < count; i++) {
    const weight = random() * total; let low = 0, high = faces.length - 1;
    while (low < high) { const middle = (low + high) >>> 1; if (faces[middle].end < weight) low = middle + 1; else high = middle; }
    const { mesh, offset } = faces[low], position = mesh.geometry.attributes.position, index = mesh.geometry.index;
    a.fromBufferAttribute(position, index ? index.getX(offset) : offset).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(position, index ? index.getX(offset + 1) : offset + 1).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(position, index ? index.getX(offset + 2) : offset + 2).applyMatrix4(mesh.matrixWorld);
    const root = Math.sqrt(random()), along = random();
    dummy.position.copy(a).multiplyScalar(1 - root).addScaledVector(b, root * (1 - along)).addScaledVector(c, root * along);
    dummy.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    dummy.position.toArray(homes, i * 3);
    const width = size * (.019 + random() * .018); radii[i] = width * Math.sqrt(3) / 2;
    dummy.scale.setScalar(width); dummy.updateMatrix(); particles.setMatrixAt(i, dummy.matrix);
    color.copy([].concat(mesh.material)[0]?.color || mist).lerp(mist, .08).multiplyScalar(.85 + random() * .25); particles.setColorAt(i, color);
    for (let axis = 0; axis < 3; axis++) drifts[i * 4 + axis] = (random() - .5) * cloudSize * .42;
    drifts[i * 4 + 3] = random() * Math.PI * 2;
  }
  particles.instanceMatrix.needsUpdate = true; particles.instanceColor.needsUpdate = true;
  particles.computeBoundingSphere(); particles.boundingSphere.radius += size * .6; visual.add(particles);
  // Broad bounds stay invisible; picking follows the animated surface fragments.
  const margin = cloudSize * .22 + size * .03 + .04;
  const target = new THREE.Mesh(new THREE.BoxGeometry(extent.x + margin * 2, extent.y + margin * 2 + .2, extent.z + margin * 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
  target.material.visible = false;
  target.position.copy(center); object.add(target);
  const phase = random() * Math.PI * 2; let amount = 0;
  const sphere = new THREE.Sphere(), localRay = new THREE.Ray(), inverse = new THREE.Matrix4(), point = new THREE.Vector3(), nearest = new THREE.Vector3(), worldPoint = new THREE.Vector3();
  target.raycast = (raycaster, intersections) => {
    const options = raycaster.params.ReferenceFragments || {}, camera = raycaster.camera;
    const distance = raycaster.ray.origin.distanceTo(object.getWorldPosition(worldPoint));
    const unitsPerPixel = camera?.isPerspectiveCamera ? 2 * distance * Math.tan(camera.fov * Math.PI / 360) / (options.viewportHeight || 640) : .01;
    const tolerance = (options.pixelTolerance || 8) * unitsPerPixel;
    sphere.copy(particles.boundingSphere).applyMatrix4(visual.matrixWorld); sphere.radius += tolerance;
    if (!raycaster.ray.intersectsSphere(sphere)) return;
    if (amount > .96 && source.visible) {
      const solidHit = raycaster.intersectObject(source, true).find(hit => hit.object.isMesh);
      if (solidHit) { intersections.push({ ...solidHit, object: target, pixelDistance: 0 }); return; }
    }
    inverse.copy(visual.matrixWorld).invert(); localRay.copy(raycaster.ray).applyMatrix4(inverse);
    const scale = visual.getWorldScale(worldPoint).x, assembly = uniforms.uAssembly.value, time = uniforms.uFragmentTime.value;
    let best = Infinity, along = Infinity;
    for (let i = 0; i < particles.count; i++) {
      const phase = drifts[i * 4 + 3], pulse = .85 + .15 * Math.sin(time * 1.35 + phase);
      point.fromArray(homes, i * 3);
      point.x += drifts[i * 4] * (1 - assembly) * pulse;
      point.y += drifts[i * 4 + 1] * (1 - assembly) * pulse + Math.sin(time * .8 + phase) * .035 * (1 - assembly);
      point.z += drifts[i * 4 + 2] * (1 - assembly) * pulse;
      localRay.closestPointToPoint(point, nearest);
      const separation = Math.max(0, point.distanceTo(nearest) - radii[i] * (1 - THREE.MathUtils.smoothstep(assembly, .68, 1)));
      const pixels = separation * scale / unitsPerPixel;
      const depth = nearest.distanceTo(localRay.origin) * scale;
      if (pixels < best || (pixels === best && depth < along)) { best = pixels; along = depth; }
    }
    if (best <= (options.pixelTolerance || 8) && along >= raycaster.near && along <= raycaster.far) intersections.push({ object: target, distance: along, point: raycaster.ray.at(along, new THREE.Vector3()), pixelDistance: best });
  };
  function setDetail(distance) {
    const ratio = distance / size;
    particles.count = Math.min(count, ratio > 90 ? 240 : ratio > 55 ? 500 : ratio > 38 ? 1000 : count);
  }
  function update(time, delta, active, reduced = false) {
    const previous = amount, goal = active ? 1 : 0;
    amount = reduced ? goal : THREE.MathUtils.clamp(amount + Math.sign(goal - amount) * delta / 1.15, 0, 1);
    const assembly = amount * amount * (3 - 2 * amount); uniforms.uAssembly.value = assembly; uniforms.uFragmentTime.value = time;
    visual.position.y = (Math.sin(time * .85 + phase) * .07 + .06) * (1 - assembly);
    visual.scale.setScalar(1 + Math.sin(time * 1.35 + phase) * .025 * (1 - assembly));
    particles.visible = amount < 1;
    source.visible = amount > (fadeSolid ? .55 : .82);
    if (fadeSolid && (amount !== previous || source.visible)) {
      const opacity = THREE.MathUtils.smoothstep(amount, .55, .95);
      for (const [material, original] of materials) {
        const transparent = amount < 1 || original.transparent;
        if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
        material.opacity = original.opacity * opacity; material.depthWrite = amount < 1 ? false : original.depthWrite;
      }
    }
    return previous !== amount;
  }
  update(0, 0, false);
  return { object, target, particles, source, update, setDetail, get progress() { return amount; } };
}
