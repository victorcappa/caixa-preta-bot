import { islandHeight, islandTopics, islandReferencePosition, referenceRelations } from './referenceIsland.js';

export async function createReferenceIsland(host, { items, manifest, onSelect, onObjectSelect, onAssets, onFailure, getMotion }) {
  const [THREE, { OrbitControls }, { GLTFLoader }, { DRACOLoader }] = await Promise.all([
    import('three'), import('three/addons/controls/OrbitControls.js'), import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/DRACOLoader.js')
  ]);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.65));
  renderer.setClearColor(0x02080e, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  const canvas = renderer.domElement; canvas.setAttribute('aria-label', 'Ilha holográfica das referências'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-description', 'Arraste para orbitar, use a roda para aproximar. Com foco, setas giram, mais e menos aproximam, Home volta à ilha.'); canvas.tabIndex = 0;
  host.appendChild(canvas);
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x02080e, .021);
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 150);
  const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.dampingFactor = .09;
  controls.minDistance = 5; controls.maxDistance = 36; controls.maxPolarAngle = Math.PI * .49; controls.minPolarAngle = .18;
  controls.enablePan = true; controls.screenSpacePanning = true;
  let disposed = false, dirty = true, visible = true, time = 0, last = 0, raf, selectedId, focusedObject, hologram = true;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const invalidate = () => { dirty = true; };
  controls.addEventListener('change', invalidate);
  function home() { controls.target.set(0, .15, 0); camera.position.set(14.8, 12.3, 17.3); camera.lookAt(controls.target); controls.update(); invalidate(); }
  home();
  scene.add(new THREE.HemisphereLight(0x8fdbf2, 0x081124, 2.8));
  const key = new THREE.DirectionalLight(0xc7f8ff, 4); key.position.set(2, 12, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0x4e7bfa, 3); rim.position.set(-9, 4, -6); scene.add(rim);
  const amber = new THREE.PointLight(0xff8a40, 38, 10); amber.position.set(-4, 3, 2); scene.add(amber);
  const land = new THREE.Group(); scene.add(land);
  const vertices = [], colors = [], indices = [], boundary = [];
  const segments = 96, rings = 27;
  for (let r = 0; r <= rings; r++) for (let s = 0; s <= segments; s++) {
    const angle = s / segments * Math.PI * 2;
    const coast = 1 + Math.sin(angle * 3 + .4) * .065 + Math.cos(angle * 7) * .035;
    const x = Math.cos(angle) * 8.6 * (r / rings) * coast, z = Math.sin(angle) * 7.1 * (r / rings) * coast;
    const y = islandHeight(x, z); vertices.push(x, y, z);
    const shade = .55 + Math.sin(x * 1.7 + z) * .12;
    colors.push(.045 * shade, .17 * shade, .21 * shade);
    if (r === rings) boundary.push(new THREE.Vector3(x, y + .025, z));
    if (r < rings && s < segments) { const a = r * (segments + 1) + s, b = a + segments + 1; indices.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  land.add(new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 4, specular: 0x0b1823, side: THREE.DoubleSide })));
  const edges = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x4bd7ce, transparent: true, opacity: .16 })); land.add(edges);
  const coast = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(boundary), new THREE.LineBasicMaterial({ color: 0x7ef8e2, transparent: true, opacity: .75 })); land.add(coast);
  const underVertices = [], underIndices = [];
  boundary.forEach((p, i) => { underVertices.push(p.x, p.y, p.z, p.x * .65, -1.7 - Math.sin(i * .4) * .5, p.z * .65); });
  for (let i = 0; i < boundary.length - 1; i++) { const n = i * 2; underIndices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
  const underside = new THREE.BufferGeometry(); underside.setAttribute('position', new THREE.Float32BufferAttribute(underVertices, 3)); underside.setIndex(underIndices); underside.computeVertexNormals();
  scene.add(new THREE.Mesh(underside, new THREE.MeshStandardMaterial({ color: 0x071b25, roughness: 1, flatShading: true, side: THREE.DoubleSide })));
  const grid = new THREE.GridHelper(62, 62, 0x254b65, 0x102b3b); grid.position.y = -2.6; scene.add(grid);
  for (const radius of [10, 13, 18]) {
    const points = new THREE.EllipseCurve(0, 0, radius, radius * .86).getPoints(160);
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x4ca2b5, transparent: true, opacity: radius === 10 ? .4 : .12 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = -2.45; scene.add(ring);
  }
  const dust = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) { dust[i * 3] = Math.sin(i * 135.1) * 21; dust[i * 3 + 1] = Math.sin(i * 88.9) * 6; dust[i * 3 + 2] = Math.cos(i * 63.7) * 21; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xa8f9ef, size: .025, transparent: true, opacity: .5 })));
  // Small scenic fragments generated for this environment, separate from imported models.
  for (let i = 0; i < 18; i++) {
    const fragment = new THREE.Mesh(new THREE.BoxGeometry(.2 + (i % 3) * .13, .025, .2 + (i % 4) * .12), new THREE.MeshStandardMaterial({ color: i % 4 ? 0x638d9d : 0xd98e61, metalness: .7, roughness: .65 }));
    const x = -3.5 + Math.sin(i * 7.4) * 2.5, z = 2.8 + Math.cos(i * 4.9) * 1.4;
    fragment.position.set(x, islandHeight(x, z) + .06, z); fragment.rotation.set(.2, i, .1); scene.add(fragment);
  }
  const scanMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } }, vertexShader: 'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec3 vPos; uniform float uTime; void main(){float band=pow(max(0.,1.-abs(fract(vPos.x*.15+vPos.y*.15-uTime*.07)-.5)*2.),18.); gl_FragColor=vec4(.18,.85,.87,band*.13);}' });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(19, 16), scanMaterial); scan.rotation.x = -Math.PI / 2; scan.position.y = 1.25; scene.add(scan);
  const targets = [], nodes = new Map(), nodeGroup = new THREE.Group(); scene.add(nodeGroup);
  const dotCanvas = document.createElement('canvas'); dotCanvas.width = dotCanvas.height = 48;
  const ctx = dotCanvas.getContext('2d'), glow = ctx.createRadialGradient(24, 24, 0, 24, 24, 24); glow.addColorStop(0, '#ffffff'); glow.addColorStop(.16, '#dfffff'); glow.addColorStop(.36, '#81e8e5a0'); glow.addColorStop(1, '#81e8e500'); ctx.fillStyle = glow; ctx.fillRect(0, 0, 48, 48);
  const dotTexture = new THREE.CanvasTexture(dotCanvas);
  items.forEach((item, index) => {
    const position = islandReferencePosition(item, index), topic = islandTopics.find(topic => topic.id === item.affinities?.[0]) || islandTopics[0];
    position[1] += islandHeight(position[0], position[2]);
    const node = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture, color: topic.color, transparent: true, depthWrite: false }));
    node.position.set(...position); node.scale.setScalar(.16); node.userData.referenceId = item.id; nodeGroup.add(node); targets.push(node); nodes.set(item.id, node);
  });
  const connectionGroup = new THREE.Group(); scene.add(connectionGroup);
  const labelGroup = new THREE.Group(); scene.add(labelGroup);
  function label(text, color = '#c6ffff') {
    const c = document.createElement('canvas'); c.width = 512; c.height = 80; const context = c.getContext('2d');
    context.fillStyle = '#03121ddd'; context.fillRect(0, 0, 512, 80); context.fillStyle = color; context.font = '22px monospace'; context.fillText(text.slice(0, 35), 18, 48);
    const texture = new THREE.CanvasTexture(c); const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false })); sprite.scale.set(2.7, .42, 1); return sprite;
  }
  function clearGroup(group) { for (const child of [...group.children]) { group.remove(child); child.geometry?.dispose(); child.material?.map?.dispose(); child.material?.dispose(); } }
  function select(id) {
    selectedId = id; clearGroup(connectionGroup); clearGroup(labelGroup);
    nodes.forEach((node, key) => node.scale.setScalar(key === id ? .45 : .16));
    const item = items.find(item => item.id === id), node = nodes.get(id); if (!node || !item) return;
    const marker = label(item.title); marker.position.copy(node.position).add(new THREE.Vector3(0, .6, 0)); labelGroup.add(marker);
    for (const relation of referenceRelations(item, items)) {
      const other = nodes.get(relation.id); if (!other || !other.visible || !node.visible) continue;
      const mid = node.position.clone().add(other.position).multiplyScalar(.5); mid.y += 1.1;
      const points = new THREE.QuadraticBezierCurve3(node.position, mid, other.position).getPoints(24);
      const material = relation.type === 'documented' ? new THREE.LineBasicMaterial({ color: 0xcafbe6, transparent: true, opacity: .65 }) : new THREE.LineDashedMaterial({ color: 0x70c6ea, transparent: true, opacity: .38, dashSize: .12, gapSize: .1 });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material); line.computeLineDistances(); connectionGroup.add(line);
    }
    invalidate();
  }
  const draco = new DRACOLoader(); draco.setDecoderPath('/references/island/draco/'); draco.setWorkerLimit(2);
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  const loaded = new Map(), loading = new Map(), failed = new Set(), materialPairs = [], floaters = [], outlines = [];
  function disposeTree(object) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    object.traverse(node => { if (node.geometry) geometries.add(node.geometry); for (const material of [].concat(node.material || [])) { materials.add(material); for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); } });
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
  }
  function report() { if (!disposed) onAssets({ loaded: [...loaded.keys()], loading: [...loading.keys()], failed: [...failed] }); }
  function applyMaterialMode() { materialPairs.forEach(({ original, shown }) => { shown.color?.copy(original.color); shown.emissive?.copy(original.emissive); shown.transparent = original.transparent; shown.opacity = original.opacity; if (hologram) { shown.color?.lerp(new THREE.Color(0x64d6e0), .45); shown.emissive?.add(new THREE.Color(0x082b35)); shown.transparent = true; shown.opacity = .78; } shown.needsUpdate = true; }); outlines.forEach(line => { line.visible = hologram; }); invalidate(); }
  async function loadModel(model) {
    if (loaded.has(model.id)) return loaded.get(model.id);
    if (loading.has(model.id)) return loading.get(model.id);
    failed.delete(model.id);
    const work = loader.loadAsync(model.url).then(gltf => {
      if (disposed) { disposeTree(gltf.scene); return null; }
      const object = gltf.scene, box = new THREE.Box3().setFromObject(object), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
      const factor = model.size / Math.max(size.x, size.y, size.z);
      const carrier = new THREE.Group(); carrier.userData.modelId = model.id;
      object.position.sub(center); object.position.y += size.y / 2; object.scale.setScalar(1);
      const normalizer = new THREE.Group(); normalizer.scale.setScalar(factor); normalizer.add(object); carrier.add(normalizer);
      const [x, offset, z] = model.position; carrier.position.set(x, islandHeight(x, z) + offset + .04, z); carrier.rotation.y = model.rotation;
      object.traverse(node => { if (node.isMesh) { node.userData.modelId = model.id; const originals = [].concat(node.material); const shown = originals.map(original => { const copy = original.clone(); materialPairs.push({ original, shown: copy }); return copy; }); node.material = Array.isArray(node.material) ? shown : shown[0]; targets.push(node); } });
      if (model.id === 'aviao-quebrado') object.traverse(node => { if (node.isMesh) { const outline = new THREE.LineSegments(new THREE.EdgesGeometry(node.geometry, 38), new THREE.LineBasicMaterial({ color: 0x9ceff2, transparent: true, opacity: .36 })); node.add(outline); outlines.push(outline); } });
      scene.add(carrier); loaded.set(model.id, carrier); applyMaterialMode();
      if (model.id === 'borboleta') floaters.push({ object: carrier, y: carrier.position.y });
      const text = label(model.label.toUpperCase(), '#a9ddd9'); text.scale.multiplyScalar(.55); text.position.set(x, islandHeight(x, z) + offset + Math.min(model.size * .8, 2.4) + .55, z); scene.add(text);
      invalidate(); return carrier;
    }).catch(() => { if (!disposed) failed.add(model.id); return null; }).finally(() => { loading.delete(model.id); report(); });
    loading.set(model.id, work); report(); return work;
  }
  // Sequential admissions avoid decoding six large meshes at once on mobile.
  (async () => { for (const model of manifest.models.filter(model => model.initial)) { if (disposed) break; await loadModel(model); } })();
  let transition;
  function focusObject(id) {
    const model = manifest.models.find(model => model.id === id); if (!model) return;
    focusedObject = id; loadModel(model);
    const [x, offset, z] = model.position, y = islandHeight(x, z) + offset + Math.min(model.size * .35, 1.2), distance = Math.max(4.5, model.size * 1.7);
    transition = { target: new THREE.Vector3(x, y, z), camera: new THREE.Vector3(x + distance * .7, y + distance * .65, z + distance), remaining: reduced.matches ? 0 : 1 };
    if (reduced.matches) { controls.target.copy(transition.target); camera.position.copy(transition.camera); transition = null; controls.update(); }
    invalidate();
  }
  function filter(ids, topic) {
    const allowed = new Set(ids), theme = islandTopics.find(value => value.id === topic);
    nodes.forEach((node, id) => {
      const index = items.findIndex(item => item.id === id), item = items[index]; node.visible = allowed.has(id) && (!topic || item.affinities.includes(topic));
      const position = islandReferencePosition(item, index);
      if (theme && node.visible) { const angle = index * 2.39996, radius = .5 + Math.sqrt(index % 42) * .32; position[0] = theme.center[0] + Math.cos(angle) * radius; position[2] = theme.center[1] + Math.sin(angle) * radius; }
      position[1] += islandHeight(position[0], position[2]); node.position.set(...position);
    }); select(selectedId);
  }
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(); let down;
  function hit(event) { const rect = canvas.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera); return raycaster.intersectObjects(targets.filter(target => target.visible), false)[0]?.object; }
  function pointerDown(event) { down = [event.clientX, event.clientY]; transition = null; }
  function pointerUp(event) { const start = down; down = null; if (!start || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 6) return; const target = hit(event); if (target?.userData.modelId) { focusedObject = target.userData.modelId; onObjectSelect(focusedObject); } else if (target?.userData.referenceId) onSelect(target.userData.referenceId); }
  function pointerMove(event) { if (!event.buttons) canvas.style.cursor = hit(event) ? 'pointer' : 'grab'; }
  function keyDown(event) { if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(event.key)) return; event.preventDefault(); transition = null; if (event.key === 'Home') home(); else { const offset = camera.position.clone().sub(controls.target); if (event.key.startsWith('Arrow')) offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -.1 : .1); else offset.multiplyScalar(event.key === '+' ? .9 : 1.1); camera.position.copy(controls.target).add(offset); controls.update(); invalidate(); } }
  function contextLost(event) { event.preventDefault(); onFailure(); }
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('keydown', keyDown); canvas.addEventListener('webglcontextlost', contextLost);
  const observer = new ResizeObserver(() => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); invalidate(); }); observer.observe(host);
  const visibility = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) invalidate(); }); visibility.observe(host);
  function animate(now) {
    if (disposed) return;
    raf = requestAnimationFrame(animate); const dt = Math.min((now - last) / 1000, .05); last = now;
    if (!visible || document.hidden) return;
    const moving = !reduced.matches && !getMotion().paused;
    controls.autoRotate = moving && !down && !transition; controls.autoRotateSpeed = .16;
    if (moving) { time += dt; scanMaterial.uniforms.uTime.value = time; floaters.forEach(({ object, y }) => { object.position.y = y + Math.sin(time * .7) * .12; }); dirty = true; }
    if (transition) { controls.target.lerp(transition.target, .12); camera.position.lerp(transition.camera, .12); transition.remaining -= dt; if (transition.remaining <= 0) transition = null; dirty = true; }
    controls.update();
    if (dirty) { renderer.render(scene, camera); dirty = false; }
  }
  raf = requestAnimationFrame(animate);
  return { select, filter, focusObject, home, material(value) { hologram = value; applyMaterialMode(); },
    destroy() { disposed = true; cancelAnimationFrame(raf); observer.disconnect(); visibility.disconnect(); controls.removeEventListener('change', invalidate); controls.dispose();
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('keydown', keyDown); canvas.removeEventListener('webglcontextlost', contextLost);
      draco.dispose(); disposeTree(scene); materialPairs.forEach(pair => pair.original.dispose()); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    }
  };
}
