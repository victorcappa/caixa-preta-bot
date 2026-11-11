const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { chromium } = require('playwright');

async function recordTurntable(settings, { progress = async () => {}, cancelled = async () => false } = {}) {
  const threeRoot = path.resolve(path.dirname(require.resolve('three')), '..');
  const prefix = '/' + randomUUID() + '/';
  let browser, timer, timeout, aborted = false;
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (!pathname.startsWith(prefix) || req.headers['sec-fetch-site'] === 'cross-site') { res.writeHead(404); res.end(); return; }
      const route = pathname.slice(prefix.length);
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
      if (route === 'progress' && req.method === 'POST') {
        let input = ''; for await (const chunk of req) { input += chunk; if (input.length > 1024) throw Error('BODY_TOO_LARGE'); }
        const frame = Number(JSON.parse(input).frame);
        if (!Number.isInteger(frame) || frame < 0 || frame > settings.frames) throw Error('INVALID_FRAME');
        await progress(frame); res.writeHead(204); res.end(); return;
      }
      if (route === 'upload' && req.method === 'POST') {
        let bytes = 0;
        await pipeline(req, new Transform({ transform(chunk, _, cb) { bytes += chunk.length; cb(bytes > 200 * 1024 * 1024 ? Error('VIDEO_TOO_LARGE') : null, chunk); } }), fs.createWriteStream(settings.output, { mode: 0o600 }));
        res.writeHead(204); res.end(); return;
      }
      if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
      if (!route) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<html><head><script type="importmap">${JSON.stringify({ imports: { three: prefix + 'vendor/build/three.module.js', 'three/addons/': prefix + 'vendor/examples/jsm/' } })}</script></head><body style="margin:0;background:black"><script type="module" src="${prefix}render.mjs"></script></body></html>`); return;
      }
      if (route === 'config') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ width: settings.width, height: settings.height, fps: settings.fps, frames: settings.frames })); return; }
      let target, type;
      if (route === 'model.glb') { target = settings.input; type = 'model/gltf-binary'; }
      else if (route === 'render.mjs') { target = path.join(__dirname, '../../scripts/model-3d-browser-render.mjs'); type = 'text/javascript'; }
      else if (route.startsWith('vendor/')) {
        target = path.resolve(threeRoot, route.slice(7));
        if (!target.startsWith(threeRoot + path.sep) || !/\.(js|wasm)$/.test(target)) throw Error('INVALID_RESOURCE');
        type = target.endsWith('.wasm') ? 'application/wasm' : 'text/javascript';
      } else { res.writeHead(404); res.end(); return; }
      res.setHeader('Content-Type', type); await pipeline(fs.createReadStream(target), res);
    } catch { if (!res.headersSent) res.writeHead(500); res.end(); }
  });
  try {
    await fsp.mkdir(path.dirname(settings.output), { recursive: true });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const base = `http://127.0.0.1:${server.address().port}`;
    // Forward OS/graphics settings only, never the provider credentials loaded
    // into the private Node worker.
    const browserEnv = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'USER', 'LOGNAME', 'LANG', 'LC_ALL',
      'DISPLAY', 'WAYLAND_DISPLAY', 'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS', 'LD_LIBRARY_PATH', 'LIBGL_DRIVERS_PATH',
      'VK_ICD_FILENAMES', 'SYSTEMROOT', 'WINDIR', 'LOCALAPPDATA', 'APPDATA'].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
    browser = await chromium.launch({ headless: true, channel: 'chromium', env: browserEnv, args: process.platform === 'darwin' ? ['--use-angle=metal'] : [] });
    const page = await browser.newPage({ viewport: { width: settings.width, height: settings.height } });
    await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    timer = setInterval(async () => { if (!aborted && await cancelled()) { aborted = true; await browser.close().catch(() => {}); } }, 500);
    await page.goto(base + prefix);
    await page.waitForFunction(() => window.turntableReady || window.turntableError, null, { timeout: 60000 });
    const result = await Promise.race([
      page.evaluate(async () => { if (window.turntableError) throw Error(window.turntableError); return window.recordTurntable(); }),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('BROWSER_RENDER_TIMEOUT')), 180000); timeout.unref(); }),
    ]);
    if (!(await fsp.stat(settings.output)).size) throw Error('EMPTY_VIDEO');
    return result;
  } catch { throw Error(aborted ? 'CANCELLED' : 'BROWSER_RENDER_FAILED'); }
  finally {
    clearInterval(timer); clearTimeout(timeout); await browser?.close().catch(() => {});
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
}
module.exports = { recordTurntable };
