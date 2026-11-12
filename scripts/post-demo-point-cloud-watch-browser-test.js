import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { prepareOperatorAudit } from "./operator-public-audit-utils.js";
import { isolateEmptyPostDemoPhotos } from "./post-demo-opening-browser-audit.js";

const repository = process.cwd(), root = await prepareOperatorAudit(), base = "http://127.0.0.1:3334";
assert.notEqual(root, repository, "A atualização automática exige um servidor isolado.");
await isolateEmptyPostDemoPhotos(root);
const output = await fs.mkdtemp(path.join(os.tmpdir(), "caixa-cloud-watch-browser-"));
const photos = path.join(root, "assets/publico"), provider = path.join(output, "provider.json");
const conversionLog = path.join(output, "conversions.jsonl"), converter = path.join(output, "converter.cjs");
const prototype = "/Users/VictorCappa/.codex/.chatgpt-projects/g-p-69fcd3b88a0c81919f366bf84809f25c/output/plateia-point-cloud/resultado";
await fs.writeFile(path.join(root, "data/publico.json"), "[]");
for (const name of ["training-examples.json", "style-notes.json"]) await fs.writeFile(path.join(root, "data", name), "[]");
await fs.writeFile(provider, "{}");
await fs.writeFile(converter, `#!/usr/bin/env node
const fs = require("node:fs"), { createHash } = require("node:crypto"), { spawnSync } = require("node:child_process");
fs.appendFileSync(process.env.CLOUD_TEST_CONVERSIONS, JSON.stringify({ at:Date.now(), sha256:createHash("sha256").update(fs.readFileSync(process.argv[3])).digest("hex") }) + "\\n");
const result = spawnSync(process.env.CLOUD_TEST_REAL_CONVERTER, process.argv.slice(2), { stdio:"inherit" });
process.exit(result.status ?? 1);
`, { mode: 0o700 });
let occupied = false;
try { await fetch(base, { signal: AbortSignal.timeout(500) }); occupied = true; } catch {}
assert(!occupied, "Porta 3334 ocupada; nenhum processo existente será encerrado.");
const server = spawn(process.execPath, ["--import", fileURLToPath(new URL("./post-demo-cycle-provider.js", import.meta.url)), "node_modules/next/dist/bin/next", "start", "--port", "3334", "--hostname", "127.0.0.1"], {
  cwd: root, env: { ...process.env, OPENAI_API_KEY: "audit-only", OPENAI_BASE_URL: "https://api.openai.com/v1", CAIXA_PRETA_POST_DEMO_CYCLE_FIXTURE: provider,
    CAIXA_PRETA_SHOW_RUNTIME_DIR: path.join(output, "runtime"),
    CAIXA_PRETA_POINT_CLOUD_TOOLCHAIN: path.join(repository, ".runtime/point-cloud/toolchain"),
    CAIXA_PRETA_POINT_CLOUD_CONVERTER: converter, CLOUD_TEST_CONVERSIONS: conversionLog,
    CLOUD_TEST_REAL_CONVERTER: path.join(repository, ".runtime/point-cloud/toolchain/convert") }, stdio: ["ignore", "pipe", "pipe"]
});
let log = "", browser, projection, control, sessionId, navigations = 0, entryDocument = null;
const errors = [], cloudPosts = [], metrics = [], checks = [], navigationEvents = [], documentRequests = [];
server.stdout.on("data", chunk => { log += chunk; }); server.stderr.on("data", chunk => { log += chunk; });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function get(route) { const response = await fetch(base + route); assert(response.ok, route); return response.json(); }
async function post(route, body, expected = 200) {
  const response = await fetch(base + route, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result;
}
const state = () => get("/api/state"), details = async () => (await get("/api/post-demo")).postDemo;
const canvas = () => projection.getByLabel("Nuvem de pontos 3D da plateia", { exact: true });
async function poll(run, label, timeout = 25000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (server.exitCode !== null) throw Error(log.slice(-2500));
    const result = await run(); if (result) return result; await sleep(80);
  }
  throw Error(`Timeout: ${label}`);
}
async function conversions() {
  try { return (await fs.readFile(conversionLog, "utf8")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line)); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
}
function timeline(snapshot) {
  const postDemo = snapshot.postDemo;
  return { active: postDemo.active, status: postDemo.status, totalRounds: postDemo.totalRounds,
    openingId: postDemo.opening?.id, presentedAt: postDemo.opening?.presentedAt, manualMode: snapshot.audienceWarmup.manualMode };
}
async function waitForCloud(previous, name, savedAt, label) {
  const ready = await poll(async () => {
    const postDemo = await details(), cloud = postDemo.pointCloud;
    if (cloud.status === "failed" && Date.parse(cloud.startedAt) >= savedAt) throw Error(cloud.error);
    return cloud.status === "ready" && cloud.current?.id !== previous && cloud.sourceName === name ? cloud : null;
  }, label);
  await poll(async () => (await state()).postDemo.pointCloud?.id === ready.current.id && await canvas().count() &&
    await canvas().getAttribute("data-ready") === "true" && Number(await canvas().getAttribute("data-first-frame-at")) >= savedAt,
  `${label}: primeiro quadro por SSE sem reload`);
  const ref = (await state()).postDemo.pointCloud;
  assert.deepEqual(Object.keys(ref).sort(), ["id", "url"]);
  assert(!JSON.stringify((await state()).postDemo).includes(name), "A projeção recebeu o nome da foto.");
  assert.equal(navigations, entryDocument.navigations, "A projeção navegou ao receber uma foto nova.");
  assert.equal(documentRequests.length, entryDocument.documents, "A projeção requisitou outro documento durante a atualização.");
  assert.equal(await projection.evaluate(() => performance.timeOrigin), entryDocument.timeOrigin, "A projeção recarregou ao receber uma foto nova.");
  assert.equal(server.exitCode, null, "O servidor reiniciou durante a troca.");
  metrics.push({ label, photo: name, id: ref.id, savedToFirstFrameMs: Math.round(Number(await canvas().getAttribute("data-first-frame-at")) - savedAt), points: ready.current.pointCount });
  return ref;
}
try {
  await poll(async () => { try { return (await fetch(base + "/api/health?skipOptional=1")).ok; } catch { return false; } }, "servidor isolado");
  await post("/api/show-session", { action: "new" }); sessionId = (await state()).reliability.sessionId;
  await post("/api/audience-warmup", { action: "set-manual-mode", manualMode: true });
  await post("/api/post-demo", { action: "config", sessionId, config: { typingIntervalMs: 200, typingPauseMs: 2000, cardHoldMs: 120000, pointCloud: { preset: "rotate" } } });
  browser = await chromium.launch({ channel: "chromium", headless: true, chromiumSandbox: true, ignoreDefaultArgs: ["--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  projection = await context.newPage(); control = await context.newPage();
  for (const page of [projection, control]) {
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => {
      if (request.method() === "POST" && request.url().endsWith("/api/post-demo/point-cloud")) cloudPosts.push({ page: page === projection ? "public" : "private", body: request.postDataJSON() });
    });
  }
  projection.on("framenavigated", frame => { if (frame === projection.mainFrame()) { navigations++; navigationEvents.push({ at: Date.now(), url: frame.url() }); } });
  projection.on("request", request => { if (request.isNavigationRequest() && request.resourceType() === "document" && request.frame() === projection.mainFrame()) documentRequests.push({ at: Date.now(), url: request.url() }); });
  await projection.goto(base + "/pos-demo?projectionWindow=watch-public", { waitUntil: "domcontentloaded" });
  await control.goto(base + "/pos-demo/controle", { waitUntil: "domcontentloaded" });
  await poll(async () => Boolean((await details()).opening), "abertura iniciada");
  await post("/api/post-demo", { action: "pause", sessionId });
  await poll(async () => (await details()).pointCloud.status === "failed", "pasta inicial vazia fica privada");
  assert.match((await details()).pointCloud.error, /Nenhuma foto/);
  assert.equal(await conversions().then(value => value.length), 0);
  const pausedTimeline = timeline(await state());
  assert.equal(pausedTimeline.active, false); assert.equal(pausedTimeline.totalRounds, 0);
  assert.equal(pausedTimeline.manualMode, true);
  entryDocument = { timeOrigin: await projection.evaluate(() => performance.timeOrigin), navigations, documents: documentRequests.length };

  let savedAt = Date.now(); await fs.copyFile(path.join(prototype, "foto-teste.jpg"), path.join(photos, "saved-after-start.JPG"));
  let ref = await waitForCloud(null, "saved-after-start.JPG", savedAt, "JPEG adicionado depois do início do servidor");
  assert.deepEqual(timeline(await state()), pausedTimeline);
  assert.equal((await conversions()).length, 1);
  assert.equal((await fetch(base + "/api/game-assets?file=publico%2Fsaved-after-start.JPG")).status, 404);
  checks.push("pasta vazia inicial não bloqueia watcher; JPEG novo é convertido e publicado automaticamente sem clique/reload/restart");

  savedAt = Date.now(); await fs.copyFile(path.join(prototype, "previa.png"), path.join(photos, "latest.png"));
  ref = await waitForCloud(ref.id, "latest.png", savedAt, "PNG mais recente salvo com o servidor vivo");
  const firstTwo = await conversions(); assert.equal(firstTwo.length, 2); assert.notEqual(firstTwo[0].sha256, firstTwo[1].sha256);
  assert.deepEqual(timeline(await state()), pausedTimeline);
  await projection.screenshot({ path: path.join(output, "new-photo-public.png") });

  const privateId = await control.evaluate(() => sessionStorage.getItem("caixa-preta.projectionWindowId"));
  await control.close(); control = null;
  await poll(async () => !(await state()).projection.windows[privateId]?.connected, "controle privado fechado, projeção pública mantida");
  const samePath = path.join(photos, "latest.png"), original = await fs.stat(samePath), sameBytes = await fs.readFile(samePath);
  savedAt = Date.now(); await fs.writeFile(samePath, sameBytes); await fs.utimes(samePath, original.atime, original.mtime);
  ref = await waitForCloud(ref.id, "latest.png", savedAt, "mesmo nome regravado preservando mtime, apenas projeção pública aberta");
  assert.equal((await conversions()).length, 3);
  assert.deepEqual(timeline(await state()), pausedTimeline);
  await sleep(4500); assert.equal((await conversions()).length, 3, "A foto inalterada foi reconvertida pelo polling.");
  checks.push("PNG novo muda o conteúdo convertido; sobrescrita do mesmo nome com mtime preservado é detectada por metadados; watcher continua com só a projeção pública");

  savedAt = Date.now(); await fs.writeFile(path.join(photos, "broken.jpg"), "INCOMPLETE IMAGE");
  await poll(async () => (await details()).pointCloud.sourceName === "broken.jpg" && (await details()).pointCloud.status === "failed", "falha automática preserva nuvem anterior");
  assert.equal((await state()).postDemo.pointCloud.id, ref.id);
  assert.match((await details()).pointCloud.error, /não pode ser lida/);
  assert.equal(await projection.getByText("A foto mais recente não pode ser lida. Substitua essa foto e tente novamente.", { exact: true }).count(), 0);
  const failedCount = (await conversions()).length;
  await sleep(4500); assert.equal((await conversions()).length, failedCount, "A mesma foto inválida entrou em loop de conversão.");
  savedAt = Date.now(); await fs.copyFile(path.join(prototype, "foto-teste.jpg"), path.join(photos, "broken.jpg"));
  ref = await waitForCloud(ref.id, "broken.jpg", savedAt, "foto inválida corrigida no mesmo nome");
  assert.equal((await conversions()).length, failedCount + 1);
  assert.deepEqual(timeline(await state()), pausedTimeline);
  checks.push("falha automática mantém referência anterior e erro privado, sem repetição; corrigir o arquivo dispara outra conversão");

  await post("/api/operator", { command: "/stopall" });
  const stoppedCount = (await conversions()).length;
  await fs.copyFile(path.join(prototype, "previa.png"), path.join(photos, "after-stop.png"));
  await sleep(5000);
  assert.equal((await conversions()).length, stoppedCount, "STOP ALL permitiu uma nova conversão automática.");
  assert.equal((await state()).postDemo.pointCloud.id, ref.id);
  await post("/api/show-session", { action: "new" });
  await fs.copyFile(path.join(prototype, "foto-teste.jpg"), path.join(photos, "next-session.jpg"));
  await sleep(4500);
  const fresh = await state();
  assert.notEqual(fresh.reliability.sessionId, sessionId); assert.equal(fresh.postDemo.pointCloud, null);
  assert.equal(fresh.postDemo.active, false); assert.equal(fresh.postDemo.totalRounds, 0);
  assert.equal((await conversions()).length, stoppedCount);
  assert.equal((await fetch(base + ref.url)).status, 404);
  checks.push("STOP ALL bloqueia salvamentos posteriores; sessão seguinte fica ociosa sem herdar a nuvem ou o watcher antigo");
  assert(cloudPosts.every(request => request.page === "private" && request.body.action === "watch"), "Houve comando de geração manual ou comando privado emitido pela projeção.");
  assert.deepEqual(errors, []);
  await assert.rejects(fs.access(provider + ".requests.jsonl"), error => error.code === "ENOENT");
  const report = { ok: true, liveDepthModel: true, liveLanguageModel: false, serverPid: server.pid, restarted: false, projectionNavigations: navigations,
    entryDocument, navigationEvents, documentRequests, pausedTimeline, cardsAndManualModePreserved: true, metrics, conversionCount: stoppedCount, checks, output };
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await projection?.screenshot({ path: path.join(output, "failure-public.png") }).catch(() => {});
  await control?.screenshot({ path: path.join(output, "failure-private.png") }).catch(() => {});
  const cloud = await details().then(value => value.pointCloud).catch(() => null);
  await fs.writeFile(path.join(output, "failure.json"), JSON.stringify({ error: error.stack || String(error), cloud, conversions: await conversions(), metrics, entryDocument, navigationEvents, documentRequests }, null, 2));
  console.log("Evidence:", output); throw error;
} finally {
  await browser?.close();
  if (server.exitCode === null) { const ended = new Promise(resolve => server.once("exit", resolve)); server.kill("SIGTERM"); await ended; }
  await fs.writeFile(path.join(output, "server.log"), log);
}
