const fs = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { fixture, waitFor } = require('./model-3d-test.cjs');
const base = 'http://127.0.0.1:3321';
async function main() {
  const output = await fixture();
  const available = await new Promise(resolve => { const s = net.createServer(); s.once('error', () => resolve(false)); s.listen(3321, '127.0.0.1', () => s.close(() => resolve(true))); });
  assert(available, 'Port 3321 occupied; no process was stopped');
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '3321', '--hostname', '127.0.0.1'], {
    env: { ...process.env, OPENAI_API_KEY: '', CAIXA_PRETA_SHOW_RUNTIME_DIR: path.join(output, 'show') }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '', browser;
  server.stdout.on('data', c => { log += c; }); server.stderr.on('data', c => { log += c; });
  try {
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      if (await fetch(base + '/api/modelo-3d').then(r => r.ok, () => false)) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/modelo-3d?diagnostico', route => route.fulfill({ json: { ready: true, checks: [{ label: 'Provedor simulado para teste', ok: true }] } }));
    await page.goto(base + '/operator'); await page.getByRole('link', { name: 'modelo-3D', exact: true }).click();
    await page.getByRole('heading', { name: 'modelo-3D', exact: true }).waitFor();
    const generate = page.getByRole('button', { name: 'Gerar modelo + vídeo' }); assert(await generate.isDisabled());
    await page.locator('input[type=file]').setInputFiles({ name: 'objeto-teste.png', mimeType: 'image/png', buffer: Buffer.from('fixture image') });
    assert(await generate.isDisabled(), 'cost authorization required');
    await page.getByLabel('Autorizar esta geração no RunPod', { exact: false }).check();
    const submitted = page.waitForResponse(response => response.url() === base + '/api/modelo-3d' && response.request().method() === 'POST');
    await generate.click();
    const accepted = await submitted; assert.equal(accepted.status(), 202, await accepted.text());
    await page.getByText('Concluído', { exact: true }).waitFor();
    const tasks = (await (await fetch(base + '/api/modelo-3d')).json()).tasks; assert.equal(tasks.length, 1);
    const task = tasks[0]; await waitFor(task.id, 'done');
    const model = await fetch(base + task.modelUrl + '?download'); assert.match(model.headers.get('content-disposition'), /attachment/); assert.equal(await model.text(), 'fixture GLB');
    const video = await fetch(base + task.videoUrl, { headers: { Range: 'bytes=0-3' } }); assert.equal(video.status, 206); assert.equal(await video.text(), 'fixt');
    const invalidRange = await fetch(base + task.videoUrl, { headers: { Range: 'bytes=999-1000' } }); assert.equal(invalidRange.status, 416);
    assert.equal((await fetch(base + task.modelUrl.replace('/modelo', '/task.json'))).status, 404);
    const cross = await fetch(base + '/api/modelo-3d', { method: 'POST', headers: { origin: 'https://invalid.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, action: 'cancel' }) }); assert.equal(cross.status, 403);
    await page.reload(); await page.getByRole('link', { name: 'Baixar modelo GLB' }).waitFor();
    assert.equal((await (await fetch(base + '/api/modelo-3d')).json()).tasks.length, 1);
    const state = JSON.stringify(await (await fetch(base + '/api/state')).json()); assert(!state.includes('objeto-teste.png'), 'private tasks must not enter public showState');
    await page.screenshot({ path: path.join(output, 'modelo-3d-desktop.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, output, checks: ['Operator tab navigation', 'image upload and explicit per-generation authorization', 'task completion and reload persistence with a fake provider', 'GLB downloads and MP4 byte-range playback', 'cross-origin mutations and private-file access rejected', 'model tasks absent from public showState', 'no browser errors'], scope: 'fake provider and video; real local render is checked separately' }, null, 2));
  } finally {
    await browser?.close();
    const stopped = new Promise(resolve => server.once('exit', resolve)); server.kill('SIGTERM');
    const timeout = setTimeout(() => server.kill('SIGKILL'), 5000); await stopped; clearTimeout(timeout);
    await fs.writeFile(path.join(output, 'browser-server.log'), log);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
