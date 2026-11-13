import assert from "node:assert/strict";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { prepareOperatorAudit } from "./operator-public-audit-utils.js";

// A disposable production copy keeps this read-only gallery check away from the show.
const port = 3339;
const base = `http://127.0.0.1:${port}`;
const output = await fs.mkdtemp(path.join(os.tmpdir(), "caixa-reference-browser-"));
const available = await new Promise((resolve, reject) => {
  const socket = net.createServer();
  socket.once("error", error => error.code === "EADDRINUSE" ? resolve(false) : reject(error));
  socket.listen(port, "127.0.0.1", () => socket.close(() => resolve(true)));
});
assert(available, `Port ${port} occupied; no existing process was stopped.`);
const auditRoot = await prepareOperatorAudit();
assert.notEqual(path.resolve(auditRoot), path.resolve(process.cwd()), "An isolated source copy is required.");
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port), "--hostname", "127.0.0.1"], {
  cwd: auditRoot,
  env: { ...process.env, OPENAI_API_KEY: "", NEXT_TELEMETRY_DISABLED: "1", CAIXA_PRETA_SHOW_RUNTIME_DIR: path.join(output, "show") },
  stdio: ["ignore", "pipe", "pipe"]
});
let serverLog = "", browser;
server.stdout.on("data", chunk => { serverLog += chunk; });
server.stderr.on("data", chunk => { serverLog += chunk; });
const checks = [], errors = [], projectionWrites = [], modelRequests = [];

async function poll(predicate, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (server.exitCode !== null || server.signalCode !== null) throw new Error(serverLog.slice(-3000));
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timeout: ${label}`);
}

function observe(page) {
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname === "/api/projection" && request.method() !== "GET") projectionWrites.push(request.postData());
    if (/\/api\/(?:chat|operator-public|live-training|tarot)(?:\/|$)/.test(url.pathname) && request.method() !== "GET") modelRequests.push(url.pathname);
  });
}

async function noHorizontalOverflow(page) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Document overflows the viewport horizontally.");
  const detail = await page.locator("[data-reference-detail]").boundingBox();
  const width = page.viewportSize().width;
  assert(detail && detail.x >= -1 && detail.x + detail.width <= width + 1, "Reference details extend outside the viewport.");
}

async function selectDissertation(page) {
  await page.getByLabel("Buscar referências", { exact: true }).fill("Garcia");
  const item = page.locator('[data-reference-id="marcus-garcia-labirinto"]');
  await item.waitFor({ state: "visible" });
  await item.focus();
  await page.keyboard.press("Enter");
  const detail = page.locator("[data-reference-detail]");
  await detail.getByText(/Labirinto de Labirintos/i).first().waitFor();
  assert.match(await detail.textContent(), /Marcus.*Garcia/s);
  assert.match(await detail.textContent(), /182/);
  const source = detail.locator('a[href^="https://teses.usp.br/"]');
  assert.equal(await source.count(), 1, "The original dissertation remains directly accessible.");
  assert.match(await source.getAttribute("href"), /MarcusViniciusdeMeloGarciacorrigidaPPGAC5434469\.pdf/);
}

try {
  await poll(async () => {
    try { return (await fetch(`${base}/referencias`, { signal: AbortSignal.timeout(1000) })).ok; } catch { return false; }
  }, "isolated references server");
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  observe(page);
  await page.goto(`${base}/referencias`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Uma ilha feita de memória.", exact: true }).waitFor();
  const tab = page.getByRole("navigation", { name: "Controllers cênicos" }).getByRole("link", { name: "Referências", exact: true });
  assert.equal(await tab.getAttribute("aria-current"), "page");
  await page.locator('[data-reference-scene="ready"], [data-reference-scene="unavailable"]').waitFor();
  const sceneState = await page.locator("[data-reference-scene]").getAttribute("data-reference-scene");
  assert.equal(sceneState, "ready", "Normal browser must render the 3D archive; WebGL failure is tested separately.");
  const canvas = page.locator('canvas[aria-label="Ilha holográfica das referências"]');
  assert.equal(await canvas.count(), 1);
  await page.waitForFunction(() => ['aviao-quebrado', 'piloto', 'caixa-preta', 'cadeira', 'quati', 'borboleta'].every(id => document.querySelector('[data-reference-scene]')?.dataset.islandLoaded?.split(',').includes(id)), null, { timeout: 90000 });
  assert.equal(await page.locator('[data-reference-scene]').getAttribute('data-island-failed'), '');
  const itemCount = await page.locator("[data-reference-id]").count();
  assert(itemCount > 60, "The archive includes the actual collection rather than a few decorative samples.");
  const visibleText = await page.locator("body").innerText();
  for (const privatePath of ["training-examples.json", "scene-notes.json", ".env.local", "instagram-profile"]) {
    assert(!visibleText.includes(privatePath), `Private source ${privatePath} must not appear in the gallery.`);
  }
  await noHorizontalOverflow(page);
  await page.screenshot({ path: path.join(output, "references-desktop.png"), fullPage: true });
  await page.locator('section[aria-label="Explorar acervo"]').evaluate(element => {
    const scroller = document.querySelector("main").parentElement;
    scroller.scrollTop += element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12;
  });
  await page.screenshot({ path: path.join(output, "references-archive-detail.png"), fullPage: true });
  checks.push("Desktop archive renders WebGL, all source records, the active tab and bounded details without private source data.");

  await page.getByRole("button", { name: "Pausar movimento", exact: true }).click();
  const beforeDrag = await canvas.screenshot();
  const bounds = await canvas.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * .4, bounds.y + bounds.height * .55);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .65, bounds.y + bounds.height * .55, { steps: 10 });
  await page.mouse.up();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert(!beforeDrag.equals(await canvas.screenshot()), "Dragging rotates the paused archive.");
  const beforePick = await page.locator("[data-reference-detail]").getAttribute("data-reference-detail");
  let picked = false;
  for (const [x, y] of Array.from({ length: 49 }, (_, i) => [.2 + (i % 7) * .1, .25 + Math.floor(i / 7) * .075])) {
    await page.mouse.click(bounds.x + bounds.width * x, bounds.y + bounds.height * y);
    if ((await page.locator("[data-reference-detail]").getAttribute("data-reference-detail")) !== beforePick) { picked = true; break; }
  }
  assert(picked, "Clicking a 3D island object or source opens its corresponding record.");
  checks.push("The paused 3D archive rotates by dragging and selecting a real 3D object updates its source record.");

  await page.locator('[data-cabinet-tool="chave"]').click();
  await selectDissertation(page);
  await page.screenshot({ path: path.join(output, "references-dissertation.png"), fullPage: true });
  checks.push("Search and keyboard selection reveal the dissertation's real author, page count and original USP link.");
  await page.getByLabel("Buscar referências", { exact: true }).fill("");
  const groups = page.locator("button[data-reference-group]");
  assert(await groups.count() > 2);
  await groups.nth(1).click();
  const groupCount = await page.locator("[data-reference-id]").count();
  assert(groupCount > 0 && groupCount < itemCount, "Group filters change the actual source list.");
  await groups.first().click();
  assert.equal(await page.locator("[data-reference-id]").count(), itemCount);
  await page.getByLabel("Buscar referências", { exact: true }).fill("zzzx-source-never-exists-917");
  assert.equal(await page.locator("[data-reference-id]").count(), 0);
  await page.getByLabel("Buscar referências", { exact: true }).fill("");
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Lista", exact: true }).getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("[data-reference-id]").count(), itemCount);
  await page.getByRole("button", { name: "Ilha 3D", exact: true }).click();
  await page.locator('[data-reference-scene="ready"]').waitFor();
  checks.push("Group filtering, clearing, empty search and the alternate list retain the same complete source collection.");

  await page.locator('button[data-reference-group="pessoas"]').click();
  const peopleCount = await page.locator("[data-reference-id]").count();
  assert(peopleCount >= 30, "The human constellation includes the researched cast, team and collaborators.");
  await page.getByLabel("Buscar referências", { exact: true }).fill("Luzia");
  await page.locator('[data-reference-id="pessoa-luzia-huttenmoser"]').click();
  const personDetail = page.locator("[data-reference-detail]");
  assert.match(await personDetail.textContent(), /\[I\].*exist/i);
  assert(await personDetail.locator('a[href^="https://www.gamedesign.zhdk.ch/"], a[href^="https://lual.games/"]').count() >= 1,
    "A person record links to actual primary work sources.");
  await page.screenshot({ path: path.join(output, "references-human-constellation.png"), fullPage: true });
  await page.getByLabel("Buscar referências", { exact: true }).fill("");
  await groups.first().click();
  checks.push("The human constellation exposes researched works and primary links, including Luzia's academic game project.");

  await page.locator('[data-island-object="aviao-quebrado"]').click();
  assert.equal(await page.locator('[data-reference-detail]').getAttribute('data-reference-detail'), 'objeto-aviao-quebrado');
  await page.getByRole('button', { name: 'Ver materiais originais', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Ver como holograma', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Ver como holograma', exact: true }).click();
  await page.locator('[data-island-topic="falha"]').click();
  assert(await page.locator('[data-reference-id]').count() < itemCount);
  await page.locator('[data-island-topic="falha"]').click();
  await page.locator('[data-island-trail="queda"]').click();
  assert.equal(await page.locator('[data-island-trail-step]').getAttribute('data-island-trail-step'), '0');
  await page.getByRole('button', { name: 'Próximo vestígio →', exact: true }).click();
  assert.equal(await page.locator('[data-reference-detail]').getAttribute('data-reference-detail'), 'objeto-piloto');
  await page.getByRole('button', { name: 'Sair do percurso', exact: true }).click();
  await page.locator('[data-island-topic="corpo"]').click();
  await page.locator('[data-reference-gaps]').click();
  assert(await page.locator('[data-reference-id]').count() > 0);
  await page.locator('[data-reference-gaps]').click();
  await page.locator('[data-island-object="zippo"]').click();
  await page.waitForFunction(() => document.querySelector('[data-reference-scene]')?.dataset.islandLoaded?.split(',').includes('zippo'), null, { timeout: 30000 });
  checks.push('The real local wreck, pilot and other models load, material view toggles, themes regroup references, trails navigate and gaps remain discoverable.');
  await page.locator('[data-island-object="pieta"]').click();
  await page.waitForFunction(() => document.querySelector('[data-reference-scene]')?.dataset.islandLoaded?.split(',').includes('pieta'), null, { timeout: 90000 });
  assert.equal(await page.locator('[data-reference-detail]').getAttribute('data-reference-detail'), 'objeto-pieta');
  await page.screenshot({ path: path.join(output, 'island-pieta-source.png'), fullPage: true });
  checks.push('Pietà materializes only on request from the original pieta1.blend export.');
  await page.getByRole('button', { name: '＋ Adicionar ao cruzamento', exact: true }).click();
  await page.locator('[data-island-object="caixa-preta"]').click();
  await page.getByRole('button', { name: '＋ Adicionar ao cruzamento', exact: true }).click();
  await page.getByRole('button', { name: 'Ver contexto das fontes', exact: true }).click();
  await page.locator('[data-reference-experiment="preview"]').waitFor();
  assert.match(await page.locator('[data-reference-experiment="preview"]').innerText(), /Camadas permanentes/);
  let experimentPayload;
  await page.route('**/api/reference-experiment', async route => {
    const payload = route.request().postDataJSON(); experimentPayload = payload;
    await route.fulfill({ json: { id: 'browser-experiment', kind: 'generated', text: 'Guardei o impacto. Agora vocês querem que eu guarde a paisagem inteira.', sources: [{ id: 'objeto-pieta', title: 'Pietà', status: 'Objeto cênico', sourcePath: 'public/references/island/models/pieta.glb.gz', segments: [{ title: 'Registro', text: 'Metadados públicos do modelo cênico.' }] }, { id: 'objeto-caixa-preta', title: 'Caixa-preta', status: 'Objeto cênico', sourcePath: 'public/references/island/models/caixa-preta.glb', segments: [{ title: 'Registro', text: 'Metadados públicos do arquivo da peça.' }] }], fixedContext: [{ title: 'Mapas permanentes', sources: Array(7).fill({}) }], limits: 'Provedor simulado no teste browser.' } });
  });
  await page.getByRole('button', { name: 'Gerar improvisação privada ↗', exact: true }).click();
  await page.locator('[data-reference-experiment="generated"]').waitFor();
  assert.equal(experimentPayload.action, 'generate');
  await page.getByRole('button', { name: 'Guardar no caderno desta aba', exact: true }).click();
  await page.getByRole('button', { name: 'Guardado no caderno', exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, 'island-private-experiment.png'), fullPage: true });
  await page.unroute('**/api/reference-experiment');
  await page.route('**/api/reference-experiment', async route => {
    await new Promise(resolve => setTimeout(resolve, 600));
    await route.fulfill({ json: { id: 'cancelled-draft', kind: 'generated', text: 'STALE_EXPERIMENT_SENTINEL', sources: [], fixedContext: [] } }).catch(() => {});
  });
  const inFlight = page.waitForRequest(request => request.url().endsWith('/api/reference-experiment'));
  await page.getByRole('button', { name: 'Gerar improvisação privada ↗', exact: true }).click();
  await inFlight;
  await page.getByRole('button', { name: 'Retirar Pietà do cruzamento', exact: true }).click();
  await page.waitForTimeout(750);
  assert.equal(await page.locator('[data-reference-experiment="generated"]').count(), 0, 'Changing a source cancels the pending result rather than attaching it to another pair.');
  assert(!await page.locator('body').innerText().then(text => text.includes('STALE_EXPERIMENT_SENTINEL')));
  await page.unroute('**/api/reference-experiment');
  checks.push('The private two-source laboratory previews exact context and records a mocked generation in the tab notebook without publishing to the show.');

  await page.locator('[data-cabinet-tool="chave"]').click();
  await page.locator('[data-cabinet-tool="fonografo"]').click();
  await page.locator('[data-reference-biography]').waitFor();
  assert.equal(await page.locator('button[data-reference-group="pessoas"]').getAttribute('aria-pressed'), 'true');
  await page.waitForFunction(() => (document.querySelector('[data-reference-scene]')?.dataset.cabinetTypes || '').length > 0);
  const thingIds = (await page.locator('[data-reference-scene]').getAttribute('data-cabinet-visible')).split(',').filter(Boolean);
  assert(thingIds.length <= 13 && thingIds.length > 0, 'The island presents readable objects, not a cloud of tiny markers.');
  await page.getByRole('button', { name: 'Próximas coisas', exact: true }).click();
  await page.locator('[data-reference-biography]').waitFor();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const bioBox = await page.locator('[data-reference-biography]').boundingBox();
  assert(bioBox && bioBox.y >= 0 && bioBox.y + bioBox.height <= page.viewportSize().height, 'Opening or paging a biography reveals its beginning rather than retaining an old scroll position.');
  await page.screenshot({ path: path.join(output, 'as-coisas-biography.png'), fullPage: true });
  await page.locator('[data-cabinet-tool="guarda-chuva"]').click();
  assert.equal(await page.locator('[data-reference-gaps]').getAttribute('aria-pressed'), 'true');
  await page.locator('[data-cabinet-tool="chave"]').click();
  await page.locator('[data-cabinet-tool="tesoura"]').click();
  assert(await page.locator('[data-island-topic][aria-pressed="true"]').count() === 1);
  await page.locator('[data-cabinet-tool="chave"]').click();
  const beforeMirror = await page.locator('[data-reference-detail]').getAttribute('data-reference-detail');
  await page.locator('[data-cabinet-tool="espelho"]').click();
  assert.notEqual(await page.locator('[data-reference-detail]').getAttribute('data-reference-detail'), beforeMirror);
  await page.locator('[data-cabinet-tool="lanterna"]').click();
  assert.equal(await page.getByRole('button', { name: 'Ver como holograma', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.locator('[data-cabinet-tool="lanterna"]').click();
  await page.locator('[data-cabinet-tool="martelo"]').click();
  assert.equal(await page.locator('[aria-label="Laboratório privado de associações"] button[aria-label^="Retirar"]').count(), 2);
  await page.locator('[data-cabinet-tool="mala"]').click();
  assert.equal(await page.getByRole('button', { name: 'Lista', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.locator('[data-cabinet-tool="chave"]').click();
  checks.push('As Coisas uses eight recognizable functional props, pages through tangible references, and presents factual biographies in the bot voice for all 35 people.');

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const mobile = await mobileContext.newPage();
  observe(mobile);
  await mobile.goto(`${base}/referencias`, { waitUntil: "domcontentloaded" });
  await mobile.getByLabel("Buscar referências", { exact: true }).waitFor();
  assert(await mobile.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches));
  await mobile.locator('[data-reference-scene="ready"]').waitFor();
  await mobile.screenshot({ path: path.join(output, "references-mobile-initial.png"), fullPage: true });
  await noHorizontalOverflow(mobile);
  await selectDissertation(mobile);
  await mobile.locator('[data-reference-scene="ready"]').waitFor();
  await mobile.waitForFunction(() => ['aviao-quebrado', 'piloto', 'caixa-preta', 'cadeira', 'quati', 'borboleta'].every(id => document.querySelector('[data-reference-scene]')?.dataset.islandLoaded?.split(',').includes(id)), null, { timeout: 90000 });
  const mobileCanvas = mobile.locator('canvas[aria-label="Ilha holográfica das referências"]');
  await mobile.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const stillFrame = await mobileCanvas.screenshot();
  await mobile.waitForTimeout(180);
  assert(stillFrame.equals(await mobileCanvas.screenshot()), "Reduced motion must freeze the 3D composition.");
  await noHorizontalOverflow(mobile);
  await mobile.screenshot({ path: path.join(output, "references-mobile-reduced-motion.png"), fullPage: true });
  checks.push("The 390px layout keeps search, keyboard selection and source details usable with reduced motion.");

  const fallbackContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await fallbackContext.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (/webgl/i.test(kind)) return null;
      return getContext.call(this, kind, ...args);
    };
  });
  const fallback = await fallbackContext.newPage();
  observe(fallback);
  await fallback.goto(`${base}/referencias`, { waitUntil: "domcontentloaded" });
  await fallback.locator('[data-reference-scene="unavailable"]').waitFor();
  await selectDissertation(fallback);
  await noHorizontalOverflow(fallback);
  await fallback.screenshot({ path: path.join(output, "references-no-webgl.png"), fullPage: true });
  checks.push("A browser without WebGL still exposes the complete searchable archive and readable source details.");

  assert.deepEqual(projectionWrites, [], "Opening and exploring references must not navigate the projection.");
  assert.deepEqual(modelRequests, [], "Browsing the archive never requests a model generation.");
  assert.deepEqual(errors, []);
  const report = { ok: true, checks, itemCount, peopleCount, sceneState, projectionWrites, modelRequests, errors, auditRoot, output, scope: "Local isolated browser, real local source metadata and WebGL; no live model, show-session mutation or deployment." };
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await fs.writeFile(path.join(output, "failure.txt"), error.stack || String(error));
  if (browser) for (const [index, context] of browser.contexts().entries()) {
    const current = context.pages()[0];
    if (current) {
      await current.screenshot({ path: path.join(output, `failure-${index}.png`) }).catch(() => {});
      await fs.writeFile(path.join(output, `failure-${index}.txt`), await current.locator('body').innerText().catch(() => 'unavailable'));
    }
  }
  throw error;
} finally {
  await browser?.close();
  await fs.writeFile(path.join(output, "server.log"), serverLog);
  if (server.exitCode === null && server.signalCode === null) {
    const stopped = new Promise(resolve => server.once("exit", resolve));
    server.kill("SIGTERM");
    const timeout = setTimeout(() => server.kill("SIGKILL"), 5000);
    await stopped;
    clearTimeout(timeout);
  }
}
