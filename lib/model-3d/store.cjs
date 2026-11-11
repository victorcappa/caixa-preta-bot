const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const terminal = new Set(['done', 'failed', 'cancelled']);
const root = () => path.resolve(process.env.CAIXA_PRETA_MODEL_3D_DIR || '.runtime/model-3d');
const fail = (code, status = 400) => Object.assign(new Error(code), { status });
function validId(id) {
  if (!/^[a-f0-9-]{36}$/.test(id || '')) throw fail('INVALID_ID');
  return id;
}
const directory = id => path.join(root(), validId(id));
const file = (id, name) => path.join(directory(id), name);
async function read(id) {
  return JSON.parse(await fs.readFile(file(id, 'task.json'), 'utf8'));
}
async function save(task) {
  const target = file(task.id, 'task.json');
  const temp = `${target}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify({ ...task, updatedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  await fs.rename(temp, target);
  return task;
}
async function list() {
  const entries = await fs.readdir(root(), { withFileTypes: true }).catch(e => {
    if (e.code === 'ENOENT') return [];
    throw e;
  });
  const tasks = await Promise.all(entries.filter(e => e.isDirectory() && /^[a-f0-9-]{36}$/.test(e.name)).map(e => read(e.name)));
  return tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}
async function workerAlive(id) {
  try { return alive(Number(await fs.readFile(file(id, 'worker.lock'), 'utf8'))); }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}
async function claimPath(target) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await fs.open(target, 'wx', 0o600);
      await handle.writeFile(String(process.pid));
      await handle.close();
      return async () => fs.unlink(target).catch(() => {});
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      // A newly created lock may not have its PID yet; never steal an empty lock.
      const content = await fs.readFile(target, 'utf8');
      if (!content || alive(Number(content))) return null;
      await fs.unlink(target);
    }
  }
  return null;
}
const claim = id => claimPath(file(id, 'worker.lock'));
async function publicTask(task) {
  const active = !terminal.has(task.status);
  const interrupted = active && Date.now() - Date.parse(task.updatedAt || task.createdAt) > 10000 && !(await workerAlive(task.id));
  return {
    id: task.id, name: task.name, status: interrupted ? 'interrupted' : task.status,
    detail: task.detail || '', error: task.error || null, createdAt: task.createdAt,
    updatedAt: task.updatedAt, frame: task.frame || 0, frames: task.frames || 600,
    preset: task.preset, modelReady: Boolean(task.modelReady), videoReady: Boolean(task.videoReady),
    canCancel: active || Boolean(task.cancelPending),
    canResume: interrupted || (task.status === 'failed' && Boolean(task.modelReady)),
    imageUrl: `/api/modelo-3d/${task.id}/imagem`,
    modelUrl: task.modelReady ? `/api/modelo-3d/${task.id}/modelo` : null,
    videoUrl: task.videoReady ? `/api/modelo-3d/${task.id}/video` : null,
  };
}
module.exports = { root, directory, file, fail, validId, read, save, list, alive, workerAlive, claim, claimPath, terminal, publicTask };
