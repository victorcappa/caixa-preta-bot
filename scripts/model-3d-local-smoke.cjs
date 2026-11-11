// Real local preparation, fallback render and complete GPU video; no provider jobs.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { Readable } = require('node:stream');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');
const { loadBridge } = require('../lib/model-3d/bridge.cjs');
const assert = require('node:assert/strict');
const exec = promisify(execFile);
async function main() {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'caixa-preta-model-3d-render-'));
  const bridge = loadBridge(output), cfg = bridge.config();
  // Deny provider access even if an upstream preparation regression calls fetch.
  global.fetch = async () => { throw Error('NETWORK_DISABLED_IN_LOCAL_SMOKE'); };
  const assets = bridge.requireSource('./assets'), jobs = bridge.requireSource('./jobs'), store = bridge.requireSource('./store');
  const image = await sharp({ create: { width: 64, height: 96, channels: 4, background: '#c88728' } }).png().toBuffer();
  const asset = await assets.receive(Readable.from([image]), 'image/png', 'referencia.png');
  const [job] = await jobs.create({ operation: 'prepare-image', imageId: asset.id, requestId: randomUUID(), preparation: { removeBackground: false, enhance: false, padding: .125, resolution: 1536 } });
  const deadline = Date.now() + 60000;
  let result;
  while (Date.now() < deadline) {
    result = await store.get('jobs', job.id);
    if (['DONE', 'FAILED'].includes(result.status)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(result.status, 'DONE', result.error); assert(result.preparation.id);
  const model = path.join(output, 'asymmetric.glb');
  const generator = path.join(output, 'fixture.py');
  // A shallow object exposes the old eye-level camera: its green top disappears.
  await fs.writeFile(generator, `import bpy\nbpy.ops.wm.read_factory_settings(use_empty=True)\nbpy.ops.mesh.primitive_cube_add()\nobj=bpy.context.object\nobj.scale=(0.7,0.4,0.15)\nfor name,color in [('Orange',(0.8,0.2,0.03,1)),('Top',(0.03,0.8,0.03,1)),('Side',(0.03,0.03,0.8,1))]:\n m=bpy.data.materials.new(name);m.diffuse_color=color;obj.data.materials.append(m)\nfor face in obj.data.polygons:\n face.material_index=1 if face.normal.z>0.5 else (2 if face.normal.x>0.5 else 0)\nbpy.ops.export_scene.gltf(filepath=${JSON.stringify(model)},export_format='GLB')\n`);
  const blender = process.env.CAIXA_PRETA_BLENDER_BIN || cfg.blender;
  await exec(blender, ['--background', '--factory-startup', '--disable-autoexec', '--python-exit-code', '1', '--python', generator], { timeout: 60000, maxBuffer: 1000000 });
  const settings = path.join(output, 'settings.json'), frames = path.join(output, 'frames');
  await fs.writeFile(settings, JSON.stringify({ input: model, output: frames, frames: 12, fps: 12, width: 320, height: 180 }));
  await exec(blender, ['--background', '--factory-startup', '--disable-autoexec', '--python-exit-code', '1', '--python', path.join(__dirname, 'model-3d-render.py'), '--', settings], { timeout: 180000, maxBuffer: 3000000 });
  const files = await fs.readdir(frames); assert.equal(files.length, 12);
  const frame0 = await sharp(path.join(frames, '0000.png')).raw().toBuffer({ resolveWithObject: true });
  assert(frame0.data.subarray(0, 3).every(v => v === 0), 'background corner must be black');
  const rowBytes = frame0.info.width * frame0.info.channels;
  assert(frame0.data.subarray(0, rowBytes).every(v => v < 8), 'model must fit below the top edge');
  assert(frame0.data.subarray(-rowBytes).every(v => v < 8), 'model must fit above the bottom edge');
  assert(frame0.data.some(v => v > 80), 'model must be visible');
  const assertThreeQuarterView = pixels => {
    let top = 0, side = 0, front = 0;
    for (let i = 0; i < pixels.length; i += 3) {
      const [r, g, b] = pixels.subarray(i, i + 3);
      if (g > 80 && g > r + 15 && g > b + 15) top++;
      if (b > 80 && b > r + 15 && b > g + 15) side++;
      if (r > 80 && r > g + 15 && r > b + 15) front++;
    }
    assert(top > 100, 'elevated view must reveal the top of a shallow object');
    assert(side > 100 && front > 100, 'initial three-quarter view must reveal both side faces');
  };
  assertThreeQuarterView(frame0.data);
  assert.notDeepEqual(await fs.readFile(path.join(frames, '0000.png')), await fs.readFile(path.join(frames, '0003.png')), 'model must rotate');
  const video = path.join(output, 'smoke.mp4');
  await exec('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '12', '-i', path.join(frames, '%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', video], { timeout: 30000 });
  const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', video]);
  const report = JSON.parse(stdout); assert.equal(report.streams[0].codec_name, 'h264'); assert.equal(report.streams[0].nb_frames, '12'); assert.equal(Number(report.format.duration), 1);
  await fs.copyFile(path.join(frames, '0000.png'), path.join(output, 'preview.png'));

  process.env.CAIXA_PRETA_MODEL_3D_DIR = path.join(output, 'tasks');
  const taskStore = require('../lib/model-3d/store.cjs');
  const { renderVideo } = require('./model-3d-worker.cjs');
  const task = { id: randomUUID(), name: 'local fixture', modelReady: true, frames: 600, createdAt: new Date().toISOString() };
  await fs.mkdir(taskStore.directory(task.id), { recursive: true });
  await fs.copyFile(model, taskStore.file(task.id, 'model.glb')); await taskStore.save(task);
  const started = Date.now(); await renderVideo(task, blender);
  const elapsedMs = Date.now() - started;
  assert.equal(task.status, 'done'); assert.equal(task.localRenderer, 'webgl', 'fast renderer must be exercised, not silently bypassed');
  const full = JSON.parse(await fs.readFile(taskStore.file(task.id, 'video-info.json')));
  assert.equal(full.streams[0].r_frame_rate, '30/1'); assert.equal(full.streams[0].nb_frames, '600'); assert.equal(Number(full.format.duration), 20);
  await exec('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', taskStore.file(task.id, 'loop.mp4'), '-vf', 'select=eq(n\\,0)+eq(n\\,1)+eq(n\\,150)+eq(n\\,599)', '-fps_mode', 'vfr', path.join(output, 'verified-%02d.png')], { timeout: 30000 });
  const decoded = await Promise.all([1, 2, 3, 4].map(n => sharp(path.join(output, `verified-${String(n).padStart(2, '0')}.png`)).resize(320, 180).removeAlpha().raw().toBuffer()));
  assertThreeQuarterView(decoded[0]);
  const difference = (a, b) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length;
  assert(difference(decoded[0], decoded[2]) > 1, 'model must rotate during the exported video');
  assert(difference(decoded[0], decoded[3]) < Math.max(1, difference(decoded[0], decoded[1]) * 3), 'loop seam must be comparable to adjacent frames');
  for (const pixels of decoded) {
    assert(pixels.subarray(0, 320 * 3).every(v => v < 8) && pixels.subarray(-320 * 3).every(v => v < 8), 'black margins must remain clear throughout rotation');
    assert(pixels.some(v => v > 80), 'model must remain visible');
  }
  console.log(JSON.stringify({ ok: true, output, elapsedMs, checks: ['real ImaginAR image preparation without provider network', 'Blender fallback at 320x180/12 frames', 'visible top and both sides of a shallow object in Blender and WebGL', 'complete WebGL/FFmpeg export at 1920x1080/600 frames/30 fps/20 seconds', 'black margins, visible rotation and continuous loop seam'], scope: 'synthetic local GLB; no paid image-to-3D inference' }, null, 2));
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
