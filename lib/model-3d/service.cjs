const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createHash } = require('node:crypto');
const store = require('./store.cjs');
const exec = promisify(execFile);
const workerScript = () => path.join(process.cwd(), 'scripts/model-3d-worker.cjs');

async function launch(id) {
  if (await store.workerAlive(id)) return;
  const child = spawn(process.execPath, [workerScript(), id], {
    cwd: process.cwd(), env: process.env, detached: true, stdio: 'ignore',
  });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  child.unref();
}
async function create({ id, name, mime, buffer, preset = 'standard', removeBackground = false }) {
  store.validId(id);
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) throw store.fail('INVALID_IMAGE', 415);
  if (!buffer.length || buffer.length > 20 * 1024 * 1024) throw store.fail('IMAGE_TOO_LARGE', 413);
  if (!['draft', 'standard', 'high'].includes(preset) || typeof removeBackground !== 'boolean') throw store.fail('INVALID_OPTIONS');
  const hash = createHash('sha256').update(buffer).update(JSON.stringify({ mime, preset, removeBackground })).digest('hex');
  await fs.mkdir(store.root(), { recursive: true, mode: 0o700 });
  const lockPath = path.join(store.root(), '.admission.lock');
  const release = await store.claimPath(lockPath);
  if (!release) throw store.fail('ADMISSION_BUSY', 409);
  try {
    const existing = await store.read(id).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
    if (existing) {
      if (existing.hash !== hash) throw store.fail('REQUEST_CONFLICT', 409);
      return store.publicTask(existing);
    }
    const active = (await store.list()).find(t => !store.terminal.has(t.status) || t.cancelPending);
    if (active) throw store.fail('TASK_ACTIVE', 409);
    const blocked = await fs.access(path.join(store.root(), 'provider-block.json')).then(() => true, e => { if (e.code === 'ENOENT') return false; throw e; });
    if (blocked && !(await diagnostics()).ready) throw store.fail('GENERATION_UNAVAILABLE', 503);
    await fs.mkdir(store.directory(id), { mode: 0o700 });
    await fs.writeFile(store.file(id, 'input'), buffer, { mode: 0o600 });
    const task = { id, hash, name: String(name || 'imagem').slice(0, 160), mime, preset, removeBackground,
      status: 'queued', createdAt: new Date().toISOString(), frames: 600 };
    await store.save(task);
    await launch(id);
    return store.publicTask(task);
  } finally { await release(); }
}
async function action(id, actionName) {
  const task = await store.read(id);
  if (actionName === 'cancel') {
    await fs.writeFile(store.file(id, 'cancel'), '', { mode: 0o600 });
    if (!(await store.workerAlive(id))) await launch(id);
  } else if (actionName === 'resume') {
    const view = await store.publicTask(task);
    if (!view.canResume) throw store.fail('NOT_RESUMABLE', 409);
    await fs.rm(store.file(id, 'cancel'), { force: true });
    await launch(id);
  } else throw store.fail('INVALID_ACTION');
  return store.publicTask(await store.read(id));
}
let diagnostic;
async function diagnostics() {
  if (diagnostic && Date.now() - diagnostic.at < 20000) return diagnostic.value;
  try {
    const { stdout } = await exec(process.execPath, [workerScript(), '--diagnose'], { cwd: process.cwd(), env: process.env, timeout: 50000, maxBuffer: 100000 });
    const value = JSON.parse(stdout);
    diagnostic = { at: Date.now(), value };
    return value;
  } catch { return { ready: false, checks: [{ label: 'Diagnóstico', ok: false, message: 'Não foi possível iniciar o diagnóstico local.' }] }; }
}
module.exports = { create, action, diagnostics, launch };
