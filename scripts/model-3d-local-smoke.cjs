// Real CPU-only preparation, Blender render and H.264 loop check; no provider jobs.
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
  await fs.writeFile(generator, `import bpy\nbpy.ops.wm.read_factory_settings(use_empty=True)\nbpy.ops.mesh.primitive_cube_add()\nobj=bpy.context.object\nobj.scale=(0.4,0.2,0.7)\nm=bpy.data.materials.new('Orange');m.diffuse_color=(0.8,0.2,0.03,1);obj.data.materials.append(m)\nbpy.ops.export_scene.gltf(filepath=${JSON.stringify(model)},export_format='GLB')\n`);
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
  assert.notDeepEqual(await fs.readFile(path.join(frames, '0000.png')), await fs.readFile(path.join(frames, '0003.png')), 'model must rotate');
  const video = path.join(output, 'smoke.mp4');
  await exec('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '12', '-i', path.join(frames, '%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', video], { timeout: 30000 });
  const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', video]);
  const report = JSON.parse(stdout); assert.equal(report.streams[0].codec_name, 'h264'); assert.equal(report.streams[0].nb_frames, '12'); assert.equal(Number(report.format.duration), 1);
  await fs.copyFile(path.join(frames, '0000.png'), path.join(output, 'preview.png'));
  console.log(JSON.stringify({ ok: true, output, checks: ['real ImaginAR image preparation without network', 'real GLB import and CPU turntable render', 'black background and visible rotating model', 'H.264/yuv420p with no duplicated endpoint frame'], scope: '12 frames at 320x180; paid inference and full-resolution export are separate checks' }, null, 2));
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
