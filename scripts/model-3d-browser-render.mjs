import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

try {
  const config = await (await fetch('config')).json();
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(config.width, config.height);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0);
  const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(room, .04).texture;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(-3, 4, 5); scene.add(key);
  const draco = new DRACOLoader(); draco.setDecoderPath('vendor/examples/jsm/libs/draco/gltf/');
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  const asset = await loader.loadAsync('model.glb');
  const model = asset.scene; model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) throw Error('EMPTY_MODEL');
  const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const pivot = new THREE.Group(); scene.add(pivot); pivot.add(model); model.position.sub(center);
  const radius = Math.max(.001, Math.hypot(size.x, size.z) / 2), height = Math.max(size.y, .001);
  const aspect = config.width / config.height, scale = Math.max(height, 2 * radius / aspect) * 1.18;
  const camera = new THREE.OrthographicCamera(-scale * aspect / 2, scale * aspect / 2, scale / 2, -scale / 2, .001, Math.max(radius, height, 1) * 50);
  camera.position.set(0, 0, Math.max(radius * 5, height * 3, 1)); camera.lookAt(0, 0, 0);
  await renderer.compileAsync(scene, camera); renderer.render(scene, camera);
  window.recordTurntable = async () => {
    const started = performance.now(), stream = renderer.domElement.captureStream(0);
    const track = stream.getVideoTracks()[0];
    const mime = ['video/mp4;codecs=avc1.42E01E', 'video/webm;codecs=vp8', 'video/webm;codecs=vp9'].find(m => MediaRecorder.isTypeSupported(m));
    if (!mime || !track.requestFrame) throw Error('RECORDING_UNAVAILABLE');
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12000000 });
    const chunks = [], stopped = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = reject; });
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.start(1000);
    const clockStart = performance.now();
    for (let frame = 0; frame < config.frames; frame++) {
      const wait = clockStart + frame * 1000 / config.fps - performance.now();
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      pivot.rotation.y = Math.PI * 2 * frame / config.frames; renderer.render(scene, camera); track.requestFrame();
      if (frame % config.fps === 0) await fetch('progress', { method: 'POST', body: JSON.stringify({ frame }) });
    }
    await new Promise(resolve => setTimeout(resolve, 1000 / config.fps));
    recorder.stop(); await stopped; track.stop();
    const blob = new Blob(chunks, { type: mime });
    const uploaded = await fetch('upload', { method: 'POST', headers: { 'Content-Type': mime }, body: blob });
    if (!uploaded.ok) throw Error('VIDEO_UPLOAD_FAILED');
    await fetch('progress', { method: 'POST', body: JSON.stringify({ frame: config.frames }) });
    return { renderer: 'webgl', requestedFrames: config.frames, mime, elapsedSeconds: (performance.now() - started) / 1000, bytes: blob.size };
  };
  window.turntableReady = true;
} catch { window.turntableError = 'MODEL_RENDER_SETUP_FAILED'; }
