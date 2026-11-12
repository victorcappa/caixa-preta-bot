import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { prepareOperatorAudit } from "./operator-public-audit-utils.js";
import { installPointCloudAnimationProbe, auditPointCloudAnimation } from "./post-demo-point-cloud-animation-audit.js";
import { auditPointCloudControls } from "./post-demo-point-cloud-controls-audit.js";

const repository = process.cwd(), root = await prepareOperatorAudit(), base = "http://127.0.0.1:3331";
const auditBreathing = process.argv.includes("--animation");
const auditControls = process.argv.includes("--controls");
assert.notEqual(root, repository);
const output = await fs.mkdtemp(path.join(os.tmpdir(), "caixa-point-cloud-browser-")), runtime = path.join(output, "runtime"), provider = path.join(output, "provider.json");
// A failure switch belongs only to this isolated worker; the real converter/model are never modified.
const converter = path.join(output, "converter.cjs"), failConversion = path.join(output, "fail-conversion");
await fs.writeFile(converter, `#!/usr/bin/env node
const fs = require("node:fs"), { spawnSync } = require("node:child_process");
if (fs.existsSync(process.env.CLOUD_TEST_FAILURE)) { console.log(JSON.stringify({error:"CONVERSION_FAILED"})); process.exit(1); }
const result = spawnSync(process.env.CLOUD_TEST_REAL_CONVERTER, process.argv.slice(2), {stdio:"inherit"});
process.exit(result.status ?? 1);
`, { mode: 0o700 });
// Replace only the isolated assets symlink. Never write test photos in the real assets tree.
assert((await fs.lstat(path.join(root, "assets"))).isSymbolicLink()); await fs.unlink(path.join(root, "assets")); await fs.mkdir(path.join(root, "assets"));
for (const entry of await fs.readdir(path.join(repository, "assets"))) if (entry !== "publico") await fs.symlink(path.join(repository, "assets", entry), path.join(root, "assets", entry));
const photos = path.join(root, "assets/publico"); await fs.mkdir(photos);
const prototype = "/Users/VictorCappa/.codex/.chatgpt-projects/g-p-69fcd3b88a0c81919f366bf84809f25c/output/plateia-point-cloud/resultado";
await fs.copyFile(path.join(prototype, "previa.png"), path.join(photos, "z-older.png"));
await fs.copyFile(path.join(prototype, "foto-teste.jpg"), path.join(photos, "a-newer.JPEG"));
await fs.utimes(path.join(photos, "z-older.png"), 1000, 1000); await fs.utimes(path.join(photos, "a-newer.JPEG"), 2000, 2000);
await fs.symlink(path.join(photos, "a-newer.JPEG"), path.join(root, "assets/photo-alias.jpg"));
await fs.writeFile(path.join(root, "data/publico.json"), JSON.stringify([{ name: "publico", nomes: ["PUBLIC_NAME_SENTINEL"] }]));
for (const file of ["training-examples.json", "style-notes.json"]) await fs.writeFile(path.join(root, "data", file), "[]");
await fs.writeFile(provider, "{}");
let occupied = false; try { await fetch(base, { signal: AbortSignal.timeout(400) }); occupied = true; } catch {}
assert(!occupied, "Porta 3331 ocupada; nenhum processo existente será encerrado.");
const server = spawn(process.execPath, ["--import", fileURLToPath(new URL("./post-demo-cycle-provider.js", import.meta.url)), "node_modules/next/dist/bin/next", "start", "--port", "3331", "--hostname", "127.0.0.1"], {
  cwd: root, env: { ...process.env, OPENAI_API_KEY: "audit-only", CAIXA_PRETA_POST_DEMO_CYCLE_FIXTURE: provider,
    CAIXA_PRETA_SHOW_RUNTIME_DIR: runtime, CAIXA_PRETA_POINT_CLOUD_TOOLCHAIN: path.join(repository, ".runtime/point-cloud/toolchain"),
    CAIXA_PRETA_POINT_CLOUD_CONVERTER: converter, CLOUD_TEST_FAILURE: failConversion, CLOUD_TEST_REAL_CONVERTER: path.join(repository, ".runtime/point-cloud/toolchain/convert") }, stdio: ["ignore", "pipe", "pipe"]
});
let log = "", browser, control, projection, animationEvidence;
server.stdout.on("data", data => { log += data; }); server.stderr.on("data", data => { log += data; });
const errors = [], metrics = [], checks = [];
async function get(route) { const r = await fetch(base + route); assert(r.ok, route); return r.json(); }
async function post(route, body, status = 200) { const r = await fetch(base + route, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const value = await r.json(); assert.equal(r.status, status, JSON.stringify(value)); return value; }
async function poll(run, label, timeout = 60000) { const end = Date.now() + timeout; while (Date.now() < end) { if (server.exitCode !== null) throw Error(log.slice(-2000)); const value = await run(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 80)); } throw Error(`Timeout: ${label}`); }
const state = () => get("/api/state"), details = async () => (await get("/api/post-demo")).postDemo;
const canvas = () => projection.getByLabel("Nuvem de pontos 3D da plateia", { exact: true });
try {
  await poll(async () => { try { return (await fetch(base + "/api/health?skipOptional=1")).ok; } catch { return false; } }, "servidor");
  await post("/api/show-session", { action: "new" }); const sessionId = (await state()).reliability.sessionId;
  await post("/api/post-demo", { action: "config", sessionId, config: { typingIntervalMs: 20, typingPauseMs: 0, cardHoldMs: 1000 } });
  browser = await chromium.launch({ channel: "chromium", headless: true, chromiumSandbox: true, ignoreDefaultArgs: ["--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  if (auditBreathing || auditControls) await installPointCloudAnimationProbe(context);
  projection = await context.newPage(); control = await context.newPage();
  for (const page of [projection, control]) page.on("pageerror", error => errors.push(error.message));
  const publicRequests = []; let projectionNavigations = 0;
  projection.on("framenavigated", frame => { if (frame === projection.mainFrame()) projectionNavigations++; });
  projection.on("request", request => publicRequests.push(request.url()));
  await projection.goto(base + "/pos-demo?projectionWindow=cloud-test", { waitUntil: "domcontentloaded" });
  await control.goto(base + "/pos-demo/controle", { waitUntil: "domcontentloaded" });
  await poll(async () => (await details()).totalRounds >= 1, "cartas iniciadas");
  assert.equal(await projection.getByRole("button", { name: "Gerar point cloud", exact: true }).count(), 0);
  assert.equal(await projection.getByLabel("Habitantes possíveis da ilha").count(), 0);
  async function generate(expectedName) {
    const before = await details(), previous = before.pointCloud.current?.id;
    const clickedAt = await projection.evaluate(() => performance.timeOrigin + performance.now());
    await control.getByRole("button", { name: "Gerar point cloud", exact: true }).click();
    assert(await control.getByRole("button", { name: "Gerar point cloud", exact: true }).isDisabled());
    await poll(async () => { const s = await details(); if (s.pointCloud.status === "failed") throw Error(s.pointCloud.error); return s.pointCloud.status === "ready" && s.pointCloud.current.id !== previous; }, "conversão Core ML");
    const ready = await details(); assert.equal(ready.pointCloud.sourceName, expectedName); assert(ready.pointCloud.current.pointCount >= 147456 * 3.9, "a nova malha deve ter cerca de 4x os pontos da fixture anterior");
    await poll(async () => { const c = canvas(); return await c.count() && await c.getAttribute("data-ready") === "true" && (await state()).postDemo.pointCloud?.id === ready.pointCloud.current.id; }, "primeiro quadro na projeção");
    // Wait for the newly referenced canvas, rather than accidentally measuring the previous cloud.
    await poll(async () => Number(await canvas().getAttribute("data-first-frame-at")) > clickedAt, "primeiro quadro da nova nuvem");
    const firstFrameAt = Number(await canvas().getAttribute("data-first-frame-at"));
    const publicCloud = (await state()).postDemo.pointCloud; assert.deepEqual(Object.keys(publicCloud).sort(), ["id", "url"]);
    assert(!JSON.stringify((await state()).postDemo).includes(expectedName)); assert(!("audienceNames" in (await state()).postDemo));
    metrics.push({ photo: expectedName, clickToFirstFrameMs: Math.round(firstFrameAt - clickedAt), conversionMs: ready.pointCloud.current.durationMs, points: ready.pointCloud.current.pointCount });
    console.log(`CORE ML ${expectedName}: ${Math.round(firstFrameAt - clickedAt)} ms clique → primeiro quadro; ${ready.pointCloud.current.pointCount} pontos.`);
    return publicCloud;
  }
  const roundsBeforeCloud = (await details()).totalRounds;
  const navigationsBeforeCloud = projectionNavigations;
  const initialCloud = await generate("a-newer.JPEG");
  await projection.screenshot({ path: path.join(output, "initial-points.png") });
  const geometry = await projection.evaluate(() => {
    const c = document.querySelector('[aria-label="Ilha em nuvem de pontos"]'), text = document.querySelector('[aria-label="Fala da ilha futura"]'), card = document.querySelector("figure");
    return [c, text, card].map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right }; });
  });
  assert(geometry[0].x >= geometry[1].right && geometry[1].x >= geometry[2].right); assert(geometry[0].right <= 1920);
  const firstDistance = Number(await canvas().getAttribute("data-distance"));
  await poll(async () => Number(await canvas().getAttribute("data-distance")) > firstDistance * 3, "revelação da plateia a partir dos pontos", 20000);
  await poll(async () => await canvas().getAttribute("data-phase") === "automatic", "entrada no escuro e revelação completas", 30000);
  const firstYaw = await canvas().getAttribute("data-yaw");
  await poll(async () => Math.abs(Number(await canvas().getAttribute("data-yaw")) - Number(firstYaw)) > .005, "rotação lateral automática", 6000);
  const colored = await canvas().evaluate(element => new Promise(resolve => requestAnimationFrame(() => {
    const gl = element.getContext("webgl2"), bytes = new Uint8Array(element.width * element.height * 4); gl.readPixels(0, 0, element.width, element.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    let count = 0; for (let i = 0; i < bytes.length; i += 4) if (bytes[i] + bytes[i + 1] + bytes[i + 2] > 35) count++; resolve(count);
  }))); assert(colored > 100);
  await poll(async () => await canvas().getAttribute("data-phase") === "automatic", "revelação completa", 20000);
  const frameSample = page => page.getByLabel("Nuvem de pontos 3D da plateia", { exact: true }).evaluate(element => ({ frames: Number(element.dataset.frames), at: performance.now() }));
  const beforeFrames = await Promise.all([projection, control].map(frameSample));
  await new Promise(resolve => setTimeout(resolve, 2000));
  const afterFrames = await Promise.all([projection, control].map(frameSample));
  const framesPerSecond = afterFrames.map((sample, index) => Math.round((sample.frames - beforeFrames[index].frames) * 1000 / (sample.at - beforeFrames[index].at)));
  const graphicsRenderer = await canvas().evaluate(element => { const gl = element.getContext("webgl2"), extension = gl.getExtension("WEBGL_debug_renderer_info"); return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); });
  console.log(`GRAPHICS ${graphicsRenderer}`);
  assert(framesPerSecond.every(rate => rate >= 20), `Animação lenta em uma das janelas: ${framesPerSecond.join(" / ")} fps`);
  console.log(`ANIMATION ${framesPerSecond.join(" / ")} fps médios (projeção / controle).`);
  assert.equal(projectionNavigations, navigationsBeforeCloud, "A nuvem deve aparecer sem recarregar a projeção.");
  assert((await details()).totalRounds > roundsBeforeCloud, "As cartas devem continuar durante a geração/animação da nuvem.");
  if (auditControls) {
    await auditPointCloudControls({ projection, control, output, base, sessionId });
    checks.push("controles privados de shader/câmera, sete presets, replay independente, persistência e sincronização sem recriar o canvas");
  }
  if (auditBreathing) {
    const originalCloudSettings = (await details()).config.pointCloud;
    await post("/api/post-demo", { action: "config", sessionId, config: { pointCloud: { preset: "rotate" } } });
    await poll(async () => await canvas().getAttribute("data-preset") === "rotate" && Number(await canvas().getAttribute("data-reveal-opacity")) > .999,
      "preset de giro aplicado e completamente visível antes de medir o pulso");
    animationEvidence = await auditPointCloudAnimation({ projection, control, output });
    await post("/api/post-demo", { action: "config", sessionId, config: { pointCloud: originalCloudSettings } });
    await poll(async () => await canvas().getAttribute("data-preset") === originalCloudSettings.preset &&
      await canvas().getAttribute("data-phase") === "automatic" && Number(await canvas().getAttribute("data-reveal-opacity")) > .999,
    "entrada original concluída nas janelas antes da navegação manual", (originalCloudSettings.startDarkSeconds + originalCloudSettings.revealSeconds + 10) * 1000);
    checks.push("shader: dois ciclos completos de frente e no giro, onda entre fileiras, relógio contínuo no controle manual e zero reenvios dos vértices");
  }
  await projection.screenshot({ path: path.join(output, "revealed.png") });
  const rect = await canvas().boundingBox(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
  const oldCamera = await canvas().getAttribute("data-camera");
  await projection.mouse.move(x, y); await projection.mouse.down(); await projection.mouse.move(x + 70, y + 30, { steps: 12 }); await projection.mouse.up();
  await poll(async () => await canvas().getAttribute("data-camera") !== oldCamera, "giro manual");
  const distance = Number(await canvas().getAttribute("data-distance")); await projection.mouse.wheel(0, -400);
  await poll(async () => Number(await canvas().getAttribute("data-distance")) < distance * .95, "zoom manual");
  const oldPan = await canvas().getAttribute("data-pan"); await projection.keyboard.down("Shift"); await projection.mouse.move(x, y); await projection.mouse.down(); await projection.mouse.move(x + 70, y, { steps: 10 }); await projection.mouse.up(); await projection.keyboard.up("Shift");
  await poll(async () => await canvas().getAttribute("data-pan") !== oldPan, "deslocamento manual");
  await poll(async () => await canvas().getAttribute("data-phase") === "automatic", "retomada suave da animação", 8000);
  const privateCanvas = control.getByLabel("Nuvem de pontos 3D da plateia", { exact: true });
  assert.equal(await privateCanvas.getAttribute("data-ready"), "true");
  await control.getByRole("button", { name: "Recolher parâmetros", exact: true }).click();
  assert.equal(await control.getByRole("button", { name: "Gerar point cloud", exact: true }).count(), 0);
  assert.equal(await control.getByRole("slider").count(), 0);
  const combinedLayout = await control.evaluate(() => {
    const right = document.querySelector('[aria-label="Ilha em nuvem de pontos"]').getBoundingClientRect();
    const voice = document.querySelector('[aria-label="Fala da ilha futura"]').getBoundingClientRect();
    return { cloudX: right.x, textRight: voice.right, cloudRight: right.right, width: innerWidth };
  });
  assert(combinedLayout.cloudX >= combinedLayout.textRight && combinedLayout.cloudRight <= combinedLayout.width);
  await control.screenshot({ path: path.join(output, "combined-collapsed.png") });
  await control.getByRole("button", { name: "Mostrar parâmetros", exact: true }).click();
  const beforeReset = await state(), configBeforeReset = (await details()).config;
  const resetAt = await projection.evaluate(() => performance.timeOrigin + performance.now());
  await control.getByRole("button", { name: "RESET", exact: true }).click();
  await poll(async () => { const next = await state(); return next.postDemo.startedAt !== beforeReset.postDemo.startedAt && next.postDemo.totalRounds === 1; }, "RESET das cartas");
  await poll(async () => Number(await canvas().getAttribute("data-first-frame-at")) > resetAt && await canvas().getAttribute("data-phase") === "reveal", "RESET da revelação 3D");
  assert.deepEqual((await state()).postDemo.pointCloud, beforeReset.postDemo.pointCloud); assert.deepEqual((await details()).config, configBeforeReset);
  assert.equal((await state()).reliability.sessionId, beforeReset.reliability.sessionId);
  checks.push("Core ML real; nuvem colorida à direita sem reload; entrada bem próxima e afastamento; giro/zoom/pan e retorno automático");
  for (const file of ["publico/a-newer.JPEG", "publico%2Fa-newer.JPEG", "photo-alias.jpg", "publico/../publico/a-newer.JPEG"]) {
    const response = await fetch(base + "/api/game-assets?file=" + encodeURIComponent(file), { headers: { range: "bytes=0-30" } }); assert.equal(response.status, 404);
  }
  assert(publicRequests.every(url => !url.includes("publico") && !url.includes("a-newer")));
  await fs.utimes(path.join(photos, "z-older.png"), 3000, 3000);
  const currentCloud = await generate("z-older.png"); assert.notEqual(currentCloud.id, initialCloud.id);
  await fs.writeFile(failConversion, "fail");
  await control.getByRole("button", { name: "Gerar point cloud", exact: true }).click();
  await poll(async () => (await details()).pointCloud.status === "failed", "falha do processo conversor");
  assert.equal((await state()).postDemo.pointCloud.id, currentCloud.id);
  await poll(async () => await control.getByText("Não foi possível converter a foto. A nuvem anterior foi mantida.", { exact: true }).count(), "erro privado do conversor");
  await poll(async () => await control.getByRole("button", { name: "Gerar point cloud", exact: true }).isEnabled(), "botão liberado após falha do conversor", 8000);
  await fs.unlink(failConversion);
  await fs.writeFile(path.join(photos, "unreadable.jpg"), "NOT AN IMAGE"); await fs.utimes(path.join(photos, "unreadable.jpg"), 4000, 4000);
  await control.getByRole("button", { name: "Gerar point cloud", exact: true }).click();
  await poll(async () => (await details()).pointCloud.status === "failed", "foto ilegível"); assert.equal((await state()).postDemo.pointCloud.id, currentCloud.id);
  assert.match((await details()).pointCloud.error, /não pode ser lida/);
  await poll(async () => await control.getByRole("button", { name: "Gerar point cloud", exact: true }).isEnabled(), "botão liberado após falha", 8000);
  for (const name of await fs.readdir(photos)) await fs.unlink(path.join(photos, name));
  await control.getByRole("button", { name: "Gerar point cloud", exact: true }).click(); await poll(async () => (await details()).pointCloud.error?.includes("Nenhuma foto"), "pasta vazia");
  assert.equal((await state()).postDemo.pointCloud.id, currentCloud.id);
  await fs.copyFile(path.join(prototype, "foto-teste.jpg"), path.join(photos, "reset.jpg"));
  await post("/api/post-demo/point-cloud", { sessionId }, 202); await post("/api/show-session", { action: "new" });
  await poll(async () => !(await state()).postDemo.pointCloud && await canvas().count() === 0, "troca de sessão apaga a referência");
  await new Promise(resolve => setTimeout(resolve, 1800)); assert.equal((await state()).postDemo.pointCloud, null);
  assert.equal((await fetch(base + currentCloud.url)).status, 404); await post("/api/post-demo/point-cloud", { sessionId }, 409);
  checks.push("painel retrátil preserva nuvem à direita; RESET reinicia cartas e revelação sem reconverter foto nem alterar ajustes; seleção por mtime em cada clique; PNG/JPEG; foto original bloqueada inclusive alias/range; falha do processo, foto ilegível e pasta vazia preservam nuvem anterior; sessão nova rejeita resultado/URL antigos");
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify({ ok: true, liveDepthModel: true, liveLanguageModel: false, controlsAudit: auditControls, shaderAnimation: Boolean(animationEvidence), metrics, framesPerSecond, graphicsRenderer, checks, output }, null, 2));
  console.log(JSON.stringify({ ok: true, controlsAudit: auditControls, shaderAnimation: Boolean(animationEvidence), metrics, framesPerSecond, graphicsRenderer, checks, output }, null, 2));
} catch (error) {
  await projection?.screenshot({ path: path.join(output, "failure-public.png") }).catch(() => {}); await control?.screenshot({ path: path.join(output, "failure-control.png") }).catch(() => {});
  console.log("Evidence:", output); throw error;
} finally {
  await browser?.close(); if (server.exitCode === null) { const ended = new Promise(resolve => server.once("exit", resolve)); server.kill("SIGTERM"); await ended; }
  await fs.writeFile(path.join(output, "server.log"), log);
}
