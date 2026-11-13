import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { resolvePostDemoLayout } from "../lib/post-demo/layout.js";

const LABELS = { card: "carta", text: "texto", cloud: "modelo 3D" };
const CLOUD_LABEL = "Nuvem de pontos 3D da plateia";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b, tolerance = .12) => Math.abs(a - b) <= tolerance;

// Uses only synthetic fixtures on an isolated server. Never starts/resets a session.
export async function auditPostDemoLayout({ projection, control, output, base, sessionId, modules = ["card", "text"], checkNavigation = true }) {
  const url = new URL(base);
  assert(["localhost", "127.0.0.1"].includes(url.hostname) && url.port && url.port !== "3000", "A auditoria da composição exige servidor isolado.");
  assert(modules.every(id => Object.hasOwn(LABELS, id)), "Módulo de composição desconhecido.");
  const report = { ok: false, physicalProjector: false, modules, gestures: [], checks: [] };
  const hasCloud = modules.includes("cloud");
  let originalLayout, originalCloudSettings, originallyCollapsed, projectionNavigations = 0;
  const countNavigation = frame => { if (frame === projection.mainFrame()) projectionNavigations++; };
  projection.on("framenavigated", countNavigation);
  async function get(route) { const response = await fetch(base + route); assert(response.ok, route); return response.json(); }
  const state = () => get("/api/state");
  const details = async () => (await get("/api/post-demo")).postDemo;
  async function command(action, data = {}) {
    const response = await fetch(base + "/api/post-demo", { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ action, sessionId, ...data }) });
    const result = await response.json(); assert(response.ok, JSON.stringify(result)); return result;
  }
  async function poll(run, label, timeout = 15000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if (await run()) return; await new Promise(resolve => setTimeout(resolve, 65)); }
    throw Error(`Timeout: ${label}`);
  }
  const frame = (page, id) => page.locator(`[data-post-demo-module="${id}"]`);
  const canvas = page => page.getByLabel(CLOUD_LABEL, { exact: true });
  const handles = page => page.getByRole("button", { name: /^(Mover|Redimensionar) (carta|texto|modelo 3D)$/ });
  async function geometry(page) {
    return page.locator("[data-post-demo-layout-canvas]").evaluate((element, ids) => {
      const bounds = element.getBoundingClientRect();
      return Object.fromEntries(ids.map(id => {
        const r = element.querySelector(`[data-post-demo-module="${id}"]`).getBoundingClientRect();
        return [id, { x: (r.x - bounds.x) * 100 / bounds.width, y: (r.y - bounds.y) * 100 / bounds.height,
          width: r.width * 100 / bounds.width, height: r.height * 100 / bounds.height }];
      }));
    }, modules);
  }
  function matches(actual, expected) {
    return modules.every(id => ["x", "y", "width", "height"].every(key => near(actual[id]?.[key], expected[id]?.[key])));
  }
  async function waitLayout(expected) {
    await poll(async () => same((await details()).config.layout, expected) && same((await state()).postDemo.layout, expected), "composição salva e publicada por SSE");
    const resolved = resolvePostDemoLayout(expected, { hasCloud });
    await poll(async () => matches(await geometry(control), resolved) && matches(await geometry(projection), resolved), "retângulos normalizados sincronizados nas duas telas");
  }
  async function cloudSnapshot(page) {
    return canvas(page).evaluate(element => ({ width: element.width, height: element.height, frames: Number(element.dataset.frames),
      camera: element.dataset.camera, pan: element.dataset.pan, yaw: Number(element.dataset.yaw), phase: element.dataset.phase,
      time: element.__pointCloudAnimationProbe?.uniforms.uTime,
      uploads: element.__pointCloudAnimationProbe?.arrayBufferUploads,
      subUpdates: element.__pointCloudAnimationProbe?.arrayBufferSubUpdates }));
  }
  async function renderedTime(page, seconds) {
    await page.evaluate(duration => new Promise(resolve => {
      const start = performance.now();
      const frame = () => performance.now() - start >= duration * 1000 ? resolve() : requestAnimationFrame(frame);
      requestAnimationFrame(frame);
    }), seconds);
  }
  async function markNodes(page) {
    await page.evaluate(() => {
      const cloud = document.querySelector('[aria-label="Nuvem de pontos 3D da plateia"]');
      window.__postDemoLayoutAudit = { text: document.querySelector('[aria-label="Fala da ilha futura"]'),
        card: document.querySelector('[data-post-demo-module="card"] figure'), cloud,
        context: cloud?.getContext("webgl2") };
    });
  }
  async function assertNodes(page, cloudExpected) {
    assert(await page.evaluate(expected => {
      const previous = window.__postDemoLayoutAudit;
      const cloud = document.querySelector('[aria-label="Nuvem de pontos 3D da plateia"]');
      return previous?.text === document.querySelector('[aria-label="Fala da ilha futura"]') &&
        previous?.card === document.querySelector('[data-post-demo-module="card"] figure') &&
        (!expected || previous.cloud === cloud && previous.context === cloud?.getContext("webgl2"));
    }, cloudExpected), "Mover/redimensionar remontou a carta, a fala ou o canvas/contexto WebGL.");
  }
  async function gesture(id, resize, dx, dy) {
    const before = (await geometry(control))[id], bounds = await control.locator("[data-post-demo-layout-canvas]").boundingBox();
    const handle = control.getByRole("button", { name: `${resize ? "Redimensionar" : "Mover"} ${LABELS[id]}`, exact: true });
    const rect = await handle.boundingBox(); assert(rect, `Alça ausente: ${id}.`);
    await control.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await control.mouse.down();
    await control.mouse.move(rect.x + rect.width / 2 + bounds.width * dx / 100, rect.y + rect.height / 2 + bounds.height * dy / 100, { steps: 12 });
    await control.mouse.up();
    const expected = { ...before, ...(resize ? { width: before.width + dx, height: before.height + dy } : { x: before.x + dx, y: before.y + dy }) };
    await poll(async () => {
      const actual = (await geometry(control))[id];
      return Object.keys(expected).every(key => near(actual[key], expected[key]));
    }, `${resize ? "redimensionamento" : "movimento"} real de ${LABELS[id]}`);
    const saved = (await geometry(control))[id];
    await poll(async () => {
      const published = (await state()).postDemo.layout[id], stored = (await details()).config.layout[id];
      return published && stored && Object.keys(saved).every(key => near(saved[key], published[key]) && near(saved[key], stored[key]));
    }, `gesto de ${LABELS[id]} persistido`);
    await waitLayout((await details()).config.layout);
    await assertNodes(projection, hasCloud); await assertNodes(control, hasCloud);
    report.gestures.push({ module: id, operation: resize ? "resize" : "move", before, after: saved });
  }
  try {
    await command("pause");
    const before = await state(), ownBefore = await details();
    originalLayout = structuredClone(ownBefore.config.layout); report.originalLayout = originalLayout;
    const configBefore = structuredClone(ownBefore.config);
    originallyCollapsed = await control.getByRole("button", { name: "Mostrar parâmetros", exact: true }).count() > 0;
    if (originallyCollapsed) await control.getByRole("button", { name: "Mostrar parâmetros", exact: true }).click();
    await control.locator("#post-demo-parameters").waitFor();
    for (const page of [projection, control]) await page.waitForFunction(() => document.querySelector('[aria-label="Fala da ilha futura"] p')?.dataset.typing === "false");
    for (const id of modules) {
      assert.equal(await frame(projection, id).count(), 1); assert.equal(await frame(control, id).count(), 1);
      assert.equal(await control.getByRole("button", { name: `Mover ${LABELS[id]}`, exact: true }).count(), 1);
      assert.equal(await control.getByRole("button", { name: `Redimensionar ${LABELS[id]}`, exact: true }).count(), 1);
    }
    assert.equal(await handles(projection).count(), 0, "As alças apareceram na projeção pública.");
    const textBefore = await projection.getByLabel("Fala da ilha futura", { exact: true }).innerText();
    if (hasCloud) {
      originalCloudSettings = structuredClone(configBefore.pointCloud);
      await control.getByRole("checkbox", { name: "Movimento automático da nuvem", exact: true }).uncheck();
      await poll(async () => !(await details()).config.pointCloud.motionEnabled && !(await state()).postDemo.cloudPresentation.settings.motionEnabled,
        "movimento automático pausado para isolar as alças");
      for (const page of [projection, control]) await poll(async () => await canvas(page).getAttribute("data-ready") === "true" &&
        Number(await canvas(page).getAttribute("data-reveal-opacity")) > .999 && await canvas(page).getAttribute("data-phase") === "automatic", "nuvem inteira visível antes dos gestos");
      await renderedTime(projection, .5);
    }
    await markNodes(projection); await markNodes(control);
    const cloudBefore = hasCloud ? await Promise.all([projection, control].map(cloudSnapshot)) : null;
    report.before = { private: await geometry(control), public: await geometry(projection) };
    // Fail the first keyboard edit once. The optimistic rectangle must remain available
    // for the explicit retry, while the projection keeps its last acknowledged layout.
    const layoutBeforeFailure = structuredClone((await details()).config.layout);
    let rejected = false;
    const failFirstLayout = async route => {
      const request = route.request(), data = request.method() === "POST" ? request.postDataJSON() : null;
      if (!rejected && data?.action === "config" && data.config?.layout) {
        rejected = true;
        return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Composição não salva (auditoria)." }) });
      }
      return route.continue();
    };
    await control.route("**/api/post-demo", failFirstLayout);
    try {
      const before = (await geometry(control)).card;
      await control.getByRole("button", { name: "Redimensionar carta", exact: true }).press("ArrowUp");
      const composition = control.getByLabel("Composição do pós-demo", { exact: true });
      await composition.getByRole("alert").filter({ hasText: "Composição não salva (auditoria)." }).waitFor();
      assert(rejected, "A requisição de teste não foi interceptada.");
      assert.deepEqual((await details()).config.layout, layoutBeforeFailure);
      assert.deepEqual((await state()).postDemo.layout, layoutBeforeFailure);
      const pending = (await geometry(control)).card;
      assert(near(pending.height, before.height - 1), "Uma falha descartou o retângulo otimista da alça.");
      await composition.getByRole("button", { name: "TENTAR NOVAMENTE", exact: true }).click();
      await poll(async () => near((await details()).config.layout.card?.height, pending.height), "retry da composição salva");
      await waitLayout((await details()).config.layout);
      assert.equal(await composition.getByRole("alert").count(), 0);
    } finally {
      await control.unroute("**/api/post-demo", failFirstLayout);
    }
    report.checks.push("falha 503 não descarta o gesto; projeção conserva composição anterior; TENTAR NOVAMENTE publica e salva o retângulo pendente");
    for (const id of modules) {
      // Shrinking first leaves room for a subsequent move, without testing clamping by accident.
      await gesture(id, true, id === "text" && !hasCloud ? -8 : -5, -12);
      await gesture(id, false, id === "cloud" ? -3 : 3, 3);
    }
    report.savedLayout = structuredClone((await details()).config.layout);
    await waitLayout(report.savedLayout);
    assert.equal(await projection.getByLabel("Fala da ilha futura", { exact: true }).innerText(), textBefore, "O gesto reiniciou/avançou a digitação pausada.");
    report.checks.push("alças reais de mover/redimensionar; porcentagens salvas e refletidas por SSE sem reload; carta e fala preservadas");
    if (hasCloud) {
      await renderedTime(projection, .35);
      const after = await Promise.all([projection, control].map(cloudSnapshot));
      for (let index = 0; index < after.length; index++) {
        assert(after[index].width !== cloudBefore[index].width && after[index].height !== cloudBefore[index].height, "O ResizeObserver não atualizou o tamanho do desenho WebGL.");
        assert(after[index].time > cloudBefore[index].time + .3 && after[index].frames > cloudBefore[index].frames, "O shader parou durante os gestos.");
        assert.equal(after[index].camera, cloudBefore[index].camera, "A alça também girou a câmera 3D.");
        assert.equal(after[index].pan, cloudBefore[index].pan, "A alça também deslocou a câmera 3D.");
        assert.equal(after[index].yaw, cloudBefore[index].yaw, "A alça também girou a nuvem.");
        assert.equal(after[index].uploads, cloudBefore[index].uploads, "O resize reenviou vértices à GPU.");
        assert.equal(after[index].subUpdates, cloudBefore[index].subUpdates, "O resize alterou buffers de vértices.");
        assert.equal(after[index].phase, "automatic", "A alça acionou a navegação manual do modelo.");
      }
      report.cloud = { before: cloudBefore, after };
      const box = await canvas(control).boundingBox(), cameraBefore = after[1].camera;
      await control.mouse.move(box.x + box.width * .55, box.y + box.height * .5); await control.mouse.down();
      await control.mouse.move(box.x + box.width * .55 + 55, box.y + box.height * .5 + 20, { steps: 12 }); await control.mouse.up();
      await poll(async () => (await cloudSnapshot(control)).camera !== cameraBefore, "OrbitControls preservado após redimensionar");
      const manual = await cloudSnapshot(control); await renderedTime(control, .35);
      assert((await cloudSnapshot(control)).time > manual.time + .2, "O shader parou na navegação manual após o resize.");
      await assertNodes(control, true); await assertNodes(projection, true);
      report.checks.push("resize sem recriar canvas/contexto ou reenviar vértices; shader contínuo; alças isoladas de OrbitControls; giro manual preservado");
    }
    await control.getByRole("button", { name: "Recolher parâmetros", exact: true }).click();
    assert.equal(await handles(control).count(), 0, "As alças continuaram visíveis com o painel recolhido.");
    assert.equal(await handles(projection).count(), 0);
    await poll(async () => matches(await geometry(control), resolvePostDemoLayout(report.savedLayout, { hasCloud })), "composição proporcional com o painel recolhido");
    await assertNodes(control, hasCloud); await assertNodes(projection, hasCloud);
    await control.screenshot({ path: path.join(output, "layout-private-collapsed.png") });
    await control.getByRole("button", { name: "Mostrar parâmetros", exact: true }).click();
    if (checkNavigation) {
      await control.locator('nav a[href="/operator"]').click();
      await control.waitForURL(base + "/operator");
      assert.deepEqual((await details()).config.layout, report.savedLayout);
      await control.locator('nav a[href="/pos-demo/controle"]').click();
      await control.waitForURL(base + "/pos-demo/controle");
      await control.locator("#post-demo-parameters").waitFor();
      await waitLayout(report.savedLayout);
      report.checks.push("troca de aba privada preserva composição sem navegar/recarregar a projeção");
    }
    await control.reload(); await control.locator("#post-demo-parameters").waitFor();
    await waitLayout(report.savedLayout);
    if (hasCloud) await poll(async () => await canvas(control).count() && await canvas(control).getAttribute("data-ready") === "true", "canvas privado recuperado após reload");
    for (const id of modules) assert.equal(await control.getByRole("button", { name: `Mover ${LABELS[id]}`, exact: true }).count(), 1);
    await assertNodes(projection, hasCloud);
    const after = await state();
    assert.equal(after.reliability.sessionId, before.reliability.sessionId);
    assert.equal(after.audienceWarmup.manualMode, before.audienceWarmup.manualMode);
    assert.equal(after.postDemo.totalRounds, before.postDemo.totalRounds);
    assert.equal(after.postDemo.startedAt, before.postDemo.startedAt);
    assert.equal(after.postDemo.active, false);
    assert.deepEqual(after.postDemo.rounds, before.postDemo.rounds, "Compor a tela alterou a história das cartas.");
    assert.deepEqual(after.postDemo.pointCloud, before.postDemo.pointCloud, "Compor a tela mudou a referência à nuvem da sessão.");
    const configAfter = (await details()).config;
    for (const key of Object.keys(configBefore).filter(key => !["layout", ...(hasCloud ? ["pointCloud"] : [])].includes(key))) {
      assert.deepEqual(configAfter[key], configBefore[key], `Compor a tela alterou ${key}.`);
    }
    assert.equal(projectionNavigations, 0, "Um ajuste de composição recarregou/navegou a projeção.");
    report.after = { private: await geometry(control), public: await geometry(projection) };
    await projection.screenshot({ path: path.join(output, "layout-public.png") });
    await control.screenshot({ path: path.join(output, "layout-private.png") });
    report.checks.push("reload e painel retrátil preservam composição; sem alças públicas nem alterações de cartas/modo manual/parâmetros");
    report.ok = true;
  } catch (error) {
    report.error = error.stack || String(error);
    throw error;
  } finally {
    try {
      if (originalLayout) {
        await command("config", { config: { layout: originalLayout, ...(originalCloudSettings ? { pointCloud: originalCloudSettings } : {}) } });
        await waitLayout(originalLayout);
      }
      if (originallyCollapsed === true && await control.getByRole("button", { name: "Recolher parâmetros", exact: true }).count()) {
        await control.getByRole("button", { name: "Recolher parâmetros", exact: true }).click();
      }
    } catch (error) {
      report.ok = false; report.restoreError = error.stack || String(error);
      throw error;
    } finally {
      projection.off("framenavigated", countNavigation);
      await fs.writeFile(path.join(output, "layout-report.json"), JSON.stringify(report, null, 2));
    }
  }
  assert(report.ok, report.error || report.restoreError);
  return report;
}
