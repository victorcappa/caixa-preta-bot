import { islandHeight, referenceRelations, referencePeoplePosition } from './referenceIsland.js';
import { cabinetTools, cabinetPage, referenceThing } from './referenceThings.js';
import { createReferenceThing } from './createReferenceThing.js';
import { createReferenceSuns } from './createReferenceSuns.js';
import { createReferenceFragments } from './createReferenceFragments.js';

export async function createReferenceIsland(host, { items, manifest, onSelect, onObjectSelect, onAssets, onFailure, onTool, onHover, onDisplay, onAssembly, getMotion }) {
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
  controls.minDistance = 2.2; controls.maxDistance = 36; controls.maxPolarAngle = Math.PI * .49; controls.minPolarAngle = .18;
  controls.enablePan = true; controls.screenSpacePanning = true;
  let disposed = false, dirty = true, visible = true, time = 0, last = 0, raf, selectedId, focusedObject, transition, hovered, integratedId, assemblyPhase, labelsVisible = true, scenicVisible = true, hologram = true;
  const fragments = new Map(), referenceFragments = new Set();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const invalidate = () => { dirty = true; };
  controls.addEventListener('change', invalidate);
  function showLabels(value) { labelsVisible = value; scene.traverse(node => { if (node.userData.islandLabel) node.visible = value && (!node.userData.modelId || scenicVisible) && (!node.userData.personLabel || node.userData.referenceId === selectedId || node.userData.referenceId === hovered); }); }
  function home() { transition = null; showLabels(true); controls.target.set(0, .15, 0); camera.position.set(14.8, 12.3, 17.3).multiplyScalar(scenicVisible ? 1 : Math.max(1, 1.1 / camera.aspect)); camera.lookAt(controls.target); controls.update(); invalidate(); }
  home();
  scene.add(new THREE.HemisphereLight(0x8fdbf2, 0x081124, 2.8));
  const key = new THREE.DirectionalLight(0xc7f8ff, 4); key.position.set(2, 12, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0x4e7bfa, 3); rim.position.set(-9, 4, -6); scene.add(rim);
  const amber = new THREE.PointLight(0xff8a40, 38, 10); amber.position.set(-4, 3, 2); scene.add(amber);
  const suns = createReferenceSuns(THREE); scene.add(suns.object); suns.update(0, camera);
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
  const debris = new THREE.Group(); scene.add(debris);
  for (let i = 0; i < 18; i++) {
    const fragment = new THREE.Mesh(new THREE.BoxGeometry(.2 + (i % 3) * .13, .025, .2 + (i % 4) * .12), new THREE.MeshStandardMaterial({ color: i % 4 ? 0x638d9d : 0xd98e61, metalness: .7, roughness: .65 }));
    const x = -3.5 + Math.sin(i * 7.4) * 2.5, z = 2.8 + Math.cos(i * 4.9) * 1.4;
    fragment.position.set(x, islandHeight(x, z) + .06, z); fragment.rotation.set(.2, i, .1); debris.add(fragment);
  }
  const scanMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } }, vertexShader: 'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec3 vPos; uniform float uTime; void main(){float band=pow(max(0.,1.-abs(fract(vPos.x*.15+vPos.y*.15-uTime*.07)-.5)*2.),18.); gl_FragColor=vec4(.18,.85,.87,band*.13);}' });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(19, 16), scanMaterial); scan.rotation.x = -Math.PI / 2; scan.position.y = 1.25; scene.add(scan);
  const targets = [], nodes = new Map(), nodeGroup = new THREE.Group(); scene.add(nodeGroup);
  const connectionGroup = new THREE.Group(); scene.add(connectionGroup);
  const labelGroup = new THREE.Group(); scene.add(labelGroup);
  let display = { ids: items.map(item => item.id), topic: null, scope: 'all', page: 0 };
  const referenceTargets = new Set();
  function label(text, color = '#e5dcc3') {
    const c = document.createElement('canvas'); c.width = 512; c.height = 80; const context = c.getContext('2d');
    context.fillStyle = '#0d151de8'; context.fillRect(0, 0, 512, 80); context.fillStyle = color; context.font = '23px monospace'; context.fillText(text.slice(0, 35), 18, 48);
    const texture = new THREE.CanvasTexture(c); const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false })); sprite.scale.set(2.6, .4, 1); sprite.userData.islandLabel = true; sprite.visible = labelsVisible; return sprite;
  }
  function clearGroup(group) { for (const child of [...group.children]) { group.remove(child); disposeTree(child); } }
  const tools = new THREE.Group(), toolObjects = new Map(); scene.add(tools);
  for (const tool of cabinetTools) {
    const effect = createReferenceFragments(THREE, createReferenceThing(THREE, tool.type, { size: tool.size }), { id: `ferramenta-${tool.id}`, size: tool.size });
    const object = effect.object; fragments.set(`ferramenta-${tool.id}`, effect);
    const [x, z] = tool.position; object.position.set(x, islandHeight(x, z) + .06, z); object.rotation.y = -.3;
    effect.target.userData.toolId = tool.id; targets.push(effect.target); tools.add(object); toolObjects.set(tool.id, object);
    const tag = label(tool.label.toUpperCase(), '#f0d9a5'); tag.position.set(x, object.position.y + object.userData.height + .24, z); tag.userData.toolId = tool.id; targets.push(tag); tools.add(tag);
  }
  function rebuildThings() {
    for (const id of referenceFragments) fragments.delete(id); referenceFragments.clear();
    clearGroup(nodeGroup); nodes.clear();
    for (const target of referenceTargets) { const index = targets.indexOf(target); if (index >= 0) targets.splice(index, 1); } referenceTargets.clear();
    const overview = display.scope === 'all' && !display.topic && display.page === 0 && display.ids.length === items.length;
    const peopleOnly = display.scope === 'pessoas';
    const portion = cabinetPage(items, display.ids, selectedId, display.page, overview, peopleOnly);
    let shown = portion.items;
    if (overview) {
      const selected = items.find(item => item.id === selectedId);
      const ids = [selectedId, ...(selected ? referenceRelations(selected, items).slice(0, 5).map(relation => relation.id) : [])];
      shown = ids.map(id => items.find(item => item.id === id)).filter(item => item && !item.modelId);
    }
    shown.forEach((item, index) => {
      const thing = referenceThing(item), primary = item.id === selectedId, size = peopleOnly ? 1 : primary ? 1.55 : 1.05;
      const effect = createReferenceFragments(THREE, createReferenceThing(THREE, thing.type, { size }), { id: item.id, size });
      const node = effect.object; fragments.set(item.id, effect); referenceFragments.add(item.id);
      const angle = index / Math.max(shown.length, 1) * Math.PI * 2 + .25;
      const x = primary ? 4.3 : Math.cos(angle) * 6.8, z = primary ? 1.8 : Math.sin(angle) * 5.5;
      if (peopleOnly) node.position.set(...referencePeoplePosition(index, shown.length)); else node.position.set(x, islandHeight(x, z) + .08, z);
      node.rotation.y = -.25 + index * .17;
      effect.target.userData.referenceId = item.id; targets.push(effect.target); referenceTargets.add(effect.target);
      const title = item.group === 'pessoas' ? item.title : thing.name;
      const tag = label(primary ? item.title : title, primary ? '#eef7da' : '#bfc9bd');
      tag.position.set(0, node.userData.height + .32, 0); tag.userData.referenceId = item.id; tag.userData.personLabel = peopleOnly; targets.push(tag); referenceTargets.add(tag); node.add(tag);
      node.userData.focusSize = size; nodeGroup.add(node); nodes.set(item.id, node);
    });
    showLabels(labelsVisible);
    onDisplay?.({ ids: shown.map(item => item.id), types: shown.map(item => referenceThing(item).type), overview, page: portion.page, pages: portion.count, tools: display.scope === 'pessoas' ? [] : cabinetTools.map(tool => tool.id), models: display.scope === 'pessoas' ? [] : [...loaded.keys()] });
  }
  function select(id) {
    selectedId = id; clearGroup(connectionGroup); clearGroup(labelGroup);
    const item = items.find(item => item.id === id);
    if (item && !item.modelId && display.ids.includes(id) && !nodes.has(id)) rebuildThings();
    const node = nodes.get(id) || (item?.modelId ? loaded.get(item.modelId) : null);
    showLabels(labelsVisible);
    if (!node || !item || !isVisible(node)) { invalidate(); return; }
    for (const relation of referenceRelations(item, items)) {
      const other = nodes.get(relation.id); if (!other) continue;
      const from = node.position.clone(); from.y += .6;
      const to = other.position.clone(); to.y += .6;
      const mid = from.clone().add(to).multiplyScalar(.5); mid.y += 1.1;
      const points = new THREE.QuadraticBezierCurve3(from, mid, to).getPoints(24);
      const material = relation.type === 'documented' ? new THREE.LineBasicMaterial({ color: 0xb7d5a9, transparent: true, opacity: .55 }) : new THREE.LineDashedMaterial({ color: 0x8ca3b0, transparent: true, opacity: .3, dashSize: .12, gapSize: .1 });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material); line.computeLineDistances(); connectionGroup.add(line);
    }
    invalidate();
  }
  const draco = new DRACOLoader(); draco.setDecoderPath('/references/island/draco/'); draco.setWorkerLimit(2);
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  const loaded = new Map(), modelLabels = new Map(), loading = new Map(), failed = new Set(), materialPairs = [], floaters = [], outlines = [];
  function showScenicLayers() {
    const show = display.scope !== 'pessoas';
    scenicVisible = show;
    controls.maxDistance = show ? 36 : 70;
    tools.visible = show; debris.visible = show; suns.object.visible = show;
    loaded.forEach(object => { object.visible = show; }); modelLabels.forEach(label => { label.visible = show && labelsVisible; });
  }
  function disposeTree(object) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    object.traverse(node => { if (node.isInstancedMesh) node.dispose(); if (node.geometry) geometries.add(node.geometry); for (const material of [].concat(node.material || [])) { materials.add(material); for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); } });
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
      const source = new THREE.Group();
      object.position.sub(center); object.position.y += size.y / 2; object.scale.setScalar(1);
      const normalizer = new THREE.Group(); normalizer.scale.setScalar(factor); normalizer.add(object); source.add(normalizer);
      object.traverse(node => { if (node.isMesh) { const originals = [].concat(node.material); const shown = originals.map(original => { const copy = original.clone(); materialPairs.push({ original, shown: copy }); return copy; }); node.material = Array.isArray(node.material) ? shown : shown[0]; } });
      if (model.id === 'aviao-quebrado') object.traverse(node => { if (node.isMesh) { const outline = new THREE.LineSegments(new THREE.EdgesGeometry(node.geometry, 38), new THREE.LineBasicMaterial({ color: 0x9ceff2, transparent: true, opacity: .36 })); node.add(outline); outlines.push(outline); } });
      const effect = createReferenceFragments(THREE, source, { id: `objeto-${model.id}`, size: model.size, count: 1500, fadeSolid: false });
      const carrier = effect.object; carrier.userData.modelId = model.id; fragments.set(`objeto-${model.id}`, effect); effect.target.userData.modelId = model.id; targets.push(effect.target);
      const [x, offset, z] = model.position; carrier.position.set(x, islandHeight(x, z) + offset + .04, z); carrier.rotation.y = model.rotation;
      scene.add(carrier); loaded.set(model.id, carrier); applyMaterialMode();
      if (model.id === 'borboleta') floaters.push({ object: carrier, y: carrier.position.y });
      const text = label(model.label.toUpperCase(), '#a9ddd9'); text.scale.multiplyScalar(.55); text.position.set(x, islandHeight(x, z) + offset + Math.min(model.size * .8, 2.4) + .55, z); text.userData.modelId = model.id; targets.push(text); scene.add(text); modelLabels.set(model.id, text); showScenicLayers();
      invalidate(); return carrier;
    }).catch(() => { if (!disposed) failed.add(model.id); return null; }).finally(() => { loading.delete(model.id); report(); });
    loading.set(model.id, work); report(); return work;
  }
  // Sequential admissions avoid decoding six large meshes at once on mobile.
  (async () => { for (const model of manifest.models.filter(model => model.initial)) { if (disposed) break; await loadModel(model); } })();
  function approach(target, size) {
    showLabels(false);
    const direction = camera.position.clone().sub(controls.target).normalize();
    if (direction.y < .28) { direction.y = .45; direction.normalize(); }
    const distance = Math.max(3, size * 2.5);
    transition = { target, camera: target.clone().addScaledVector(direction, distance), remaining: reduced.matches ? 0 : 1 };
    if (reduced.matches) { controls.target.copy(transition.target); camera.position.copy(transition.camera); transition = null; controls.update(); }
    invalidate();
  }
  function focusObject(id) {
    if (display.scope === 'pessoas') return;
    const model = manifest.models.find(model => model.id === id); if (!model) return;
    focusedObject = id; integrate(`objeto-${id}`); loadModel(model);
    const [x, offset, z] = model.position;
    approach(new THREE.Vector3(x, islandHeight(x, z) + offset + Math.min(model.size * .35, 1.2), z), model.size);
  }
  function integrate(id) { integratedId = id; assemblyPhase = 'integrating'; onAssembly?.({ id, phase: assemblyPhase }); invalidate(); }
  function focusReference(id) { const node = nodes.get(id); if (node) { integrate(id); approach(node.position.clone().add(new THREE.Vector3(0, node.userData.height * .5, 0)), node.userData.focusSize); } }
  function focusTool(id) { const node = toolObjects.get(id); if (node && display.scope !== 'pessoas') { integrate(`ferramenta-${id}`); approach(node.position.clone().add(new THREE.Vector3(0, node.userData.height * .5, 0)), cabinetTools.find(tool => tool.id === id).size); } }
  function filter(ids, topic, scope = 'all', page = 0) { const enterPeople = scope === 'pessoas' && display.scope !== scope; display = { ids, topic, scope, page }; integratedId = null; assemblyPhase = 'fragmented'; onAssembly?.({ id: null, phase: assemblyPhase }); hovered = null; onHover?.(null); showScenicLayers(); rebuildThings(); select(selectedId); if (enterPeople) home(); }
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(); let down;
  function isVisible(target) { for (let node = target; node; node = node.parent) if (!node.visible) return false; return true; }
  function hit(event) { const rect = canvas.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera); return raycaster.intersectObjects(targets.filter(isVisible), false)[0]?.object; }
  function pointerDown(event) { down = [event.clientX, event.clientY]; transition = null; }
  function pointerUp(event) { const start = down; down = null; if (!start || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 6) return; const target = hit(event); if (target?.userData.toolId) { onTool(target.userData.toolId); } else if (target?.userData.modelId) { focusedObject = target.userData.modelId; onObjectSelect(focusedObject); } else if (target?.userData.referenceId) onSelect(target.userData.referenceId); }
  function pointerMove(event) {
    if (event.buttons) return;
    const target = hit(event); canvas.style.cursor = target ? 'pointer' : 'grab';
    const id = target?.userData.toolId || target?.userData.referenceId || target?.userData.modelId;
    if (id === hovered) return; hovered = id; showLabels(labelsVisible); invalidate();
    const tool = cabinetTools.find(tool => tool.id === target?.userData.toolId);
    const item = items.find(item => item.id === target?.userData.referenceId);
    onHover?.(tool ? { title: tool.label, use: tool.strangeUse } : item ? { title: item.title, use: item.biography || item.thing?.strangeUse } : null);
  }
  function pointerLeave() { hovered = null; showLabels(labelsVisible); onHover?.(null); invalidate(); }

  function keyDown(event) { if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(event.key)) return; event.preventDefault(); transition = null; if (event.key === 'Home') home(); else { const offset = camera.position.clone().sub(controls.target); if (event.key.startsWith('Arrow')) offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -.1 : .1); else offset.multiplyScalar(event.key === '+' ? .9 : 1.1); camera.position.copy(controls.target).add(offset); controls.update(); invalidate(); } }
  function contextLost(event) { event.preventDefault(); onFailure(); }
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerleave', pointerLeave); canvas.addEventListener('keydown', keyDown); canvas.addEventListener('webglcontextlost', contextLost);
  const observer = new ResizeObserver(() => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); if (!scenicVisible && !integratedId) home(); invalidate(); }); observer.observe(host);
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
    for (const [id, effect] of fragments) {
      if (effect.update(time, dt, id === integratedId, reduced.matches)) dirty = true;
      if (id === integratedId && effect.progress === 1 && assemblyPhase !== 'integrated') { assemblyPhase = 'integrated'; onAssembly?.({ id, phase: assemblyPhase }); }
    }
    if (dirty) { suns.update(time, camera); renderer.render(scene, camera); dirty = false; }
  }
  raf = requestAnimationFrame(animate);
  return { select, filter, focusObject, focusReference, focusTool, home, material(value) { hologram = value; applyMaterialMode(); },
    destroy() { disposed = true; cancelAnimationFrame(raf); observer.disconnect(); visibility.disconnect(); controls.removeEventListener('change', invalidate); controls.dispose();
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerleave', pointerLeave); canvas.removeEventListener('keydown', keyDown); canvas.removeEventListener('webglcontextlost', contextLost);
      draco.dispose(); disposeTree(scene); materialPairs.forEach(pair => pair.original.dispose()); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    }
  };
}
