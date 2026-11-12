import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { prepareOperatorAudit } from "./operator-public-audit-utils.js";

const root = await prepareOperatorAudit();
const output = await fs.mkdtemp(path.join(os.tmpdir(), "caixa-post-demo-browser-"));
const fixture = path.join(output, "provider.json"), base = "http://127.0.0.1:3327";
await fs.writeFile(path.join(root, "data/publico.json"), JSON.stringify([{ name: "publico", nomes: ["Alice", "Bob", "Clara"] }, { name: "equipe", nomes: ["TEAM_SENTINEL"] }]));
await fs.writeFile(path.join(root, "data/training-examples.json"), "[]");
const reply = cardId => ({ cardId, text: cardId === 0 ? "Uma máquina de ecos poderia construir outra margem para a peça. Os espelhos ainda não sabem que futuro devolver." : "A obra poderia abrir uma oficina de máquinas e memórias. A continuação ainda procura a sua margem.", question: "Quem teria o direito de continuar existindo nessa cópia?", sourcePages: [3, 5, 12], memoryIds: [], audienceNames: [] });
await fs.writeFile(fixture, JSON.stringify({ principalText: JSON.stringify(reply(0)) }));
let occupied = false;
try { await fetch(base + "/api/health", { signal: AbortSignal.timeout(700) }); occupied = true; } catch {}
assert(!occupied, "Porta 3327 ocupada; nenhum processo existente será encerrado.");
const server = spawn(process.execPath, ["--import", fileURLToPath(new URL("./operator-public-mock.js", import.meta.url)), "node_modules/next/dist/bin/next", "start", "--port", "3327", "--hostname", "127.0.0.1"], {
  cwd: root, env: { ...process.env, OPENAI_API_KEY: "audit-only", OPENAI_BASE_URL: "https://api.openai.com/v1", CAIXA_PRETA_OPERATOR_MOCK: fixture,
    CAIXA_PRETA_SHOW_RUNTIME_DIR: path.join(output, "runtime") }, stdio: ["ignore", "pipe", "pipe"]
});
let log = "", browser, projection, control;
server.stdout.on("data", chunk => { log += chunk; }); server.stderr.on("data", chunk => { log += chunk; });
const state = async () => (await fetch(base + "/api/state")).json();
async function post(route, body) {
  const response = await fetch(base + route, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json(); assert(response.ok, JSON.stringify(result)); return result;
}
async function poll(predicate, label, timeout = 25000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (server.exitCode !== null) throw new Error(log.slice(-2500)); if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 70)); }
  throw new Error(`Timeout: ${label}`);
}
const privateConfig = async () => (await (await fetch(base + "/api/post-demo")).json()).postDemo.config;
const globalSettings = async () => { const s = await state(); return { model: s.model, robotSound: s.robotSound, ...(await (await fetch(base + "/api/operator-public")).json()) }; };
const command = async (action, data = {}) => post("/api/post-demo", { action, ...data, sessionId: (await state()).reliability.sessionId });
try {
  await poll(async () => { try { return (await fetch(base + "/api/health?skipOptional=1")).ok; } catch { return false; } }, "ready");
  await post("/api/show-session", { action: "new" });
  await post("/api/operator", { command: "/memory Alice mencionou uma mala azul." });
  await post("/api/robot-sound", { settings: { typingIntervalMs: 5, typingPauseMs: 0, messageGapMs: 0 } });
  await post("/api/operator-public", { action: "patch", personality: { sarcasm: 92 }, profile: { humor: 88 } });
  await post("/api/operator", { command: "/model gpt-5.6-luna" });
  await command("config", { config: { cardHoldMs: 10000, typingIntervalMs: 40, typingPauseMs: 70, personality: { sarcasm: 23 }, profile: { humor: 17 }, model: "gpt-5.6-terra" } });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  projection = await context.newPage(); control = await context.newPage();
  const errors = [], publicActions = [];
  for (const page of [projection, control]) page.on("pageerror", error => errors.push(error.message));
  projection.on("request", request => { if (request.method() === "POST" && request.url().endsWith("/api/post-demo")) publicActions.push(request.postDataJSON().action); });
  await projection.goto(base + "/pos-demo?projectionWindow=pos-demo-test", { waitUntil: "domcontentloaded" });
  await control.goto(base + "/pos-demo/controle", { waitUntil: "domcontentloaded" });
  await poll(async () => (await state()).postDemo.totalRounds === 1, "seleção automática na entrada");
  await command("pause");
  const request = JSON.parse(await fs.readFile(fixture + ".request.json", "utf8"));
  assert.equal(request.tools, undefined); assert.equal(request.model, "gpt-5.6-terra");
  const input = JSON.stringify(request.input);
  for (const expected of ["página 12", "Mcluhan", "SARCASMO: 23%", "Humor: 17%", "EXPRESSÃO DO PÓS-DEMO"]) assert(input.includes(expected), `acervo ausente: ${expected}`);
  assert(!input.includes("TEAM_SENTINEL")); for (const name of ["Alice", "Bob", "Clara", "mala azul"]) assert(!input.includes(name), `dado da plateia enviado ao modelo: ${name}`);
  assert.equal(await projection.getByRole("button").count(), 0);
  assert.equal(await projection.getByRole("textbox").count(), 0);
  assert.equal(await projection.getByRole("slider").count(), 0);
  assert.equal(await projection.getByRole("combobox").count(), 0);
  assert(!("config" in (await state()).postDemo));
  assert.deepEqual((await state()).postDemo.presentation, { typingIntervalMs: 40, typingPauseMs: 70, displayFont: "modern-dos-8x16" });
  assert.equal(await projection.getByLabel("Habitantes possíveis da ilha").count(), 0); assert(!("audienceNames" in (await state()).postDemo));
  const first = (await state()).postDemo.rounds[0];
  assert.equal(first.card.id, 0);
  assert(!JSON.stringify(first).includes("trace") && !JSON.stringify(first).includes("rating"));
  const operator = await context.newPage();
  await operator.goto(base + "/operator", { waitUntil: "domcontentloaded" });
  assert.equal(await operator.getByRole("slider", { name: "Intervalo entre cartas do pós-demo", exact: true }).count(), 0);
  const ownBefore = await privateConfig();
  await post("/api/operator-public", { action: "patch", personality: { sarcasm: 99 }, profile: { humor: 91 } });
  await post("/api/robot-sound", { settings: { typingIntervalMs: 190, typingPauseMs: 1800, displayFont: "courier" } });
  assert.deepEqual(await privateConfig(), ownBefore, "parâmetros globais não podem alterar o pós-demo");
  const globalBefore = await globalSettings();
  await control.getByRole("slider", { name: "Intervalo entre cartas do pós-demo", exact: true }).fill("1000");
  await control.getByRole("slider", { name: "Tempo por letra do pós-demo", exact: true }).fill("20");
  await control.getByRole("slider", { name: "Pausa na pontuação do pós-demo", exact: true }).fill("0");
  await control.getByRole("slider", { name: "SARCASMO", exact: true }).fill("34");
  await control.getByRole("slider", { name: "Humor", exact: true }).fill("28");
  await control.getByLabel("Modelo do pós-demo", { exact: true }).selectOption("gpt-5.6-luna");
  await control.getByLabel("Fonte do pós-demo", { exact: true }).selectOption("vt323");
  await poll(async () => { const c = await privateConfig(); return c.cardHoldMs === 1000 && c.typingIntervalMs === 20 && c.typingPauseMs === 0 && c.personality.sarcasm === 34 && c.profile.humor === 28 && c.model === "gpt-5.6-luna" && c.displayFont === "vt323"; }, "parâmetros próprios salvos no controle pós-demo");
  const globalAfter = await globalSettings();
  for (const key of ["personality", "profile", "robotSound", "model"]) assert.deepEqual(globalAfter[key], globalBefore[key], `pós-demo não pode alterar ${key}`);
  await control.reload();
  await poll(async () => await control.getByRole("slider", { name: "Tempo por letra do pós-demo", exact: true }).inputValue() === "20", "parâmetros próprios após reload");
  await fs.writeFile(fixture, JSON.stringify({ principalText: JSON.stringify(reply(1)) }));
  await command("resume");
  await projection.getByText(reply(0).question, { exact: false }).waitFor();
  await poll(async () => (await state()).postDemo.totalRounds === 2, "segunda carta automática após digitação e intervalo");
  await command("pause");
  assert.equal((await state()).postDemo.rounds.at(-1).card.id, 1);
  const secondRequest = JSON.parse(await fs.readFile(fixture + ".request.json", "utf8"));
  assert.equal(secondRequest.model, "gpt-5.6-luna");
  assert(JSON.stringify(secondRequest.input).includes("SARCASMO: 34%"));
  assert(JSON.stringify(secondRequest.input).includes("Humor: 28%"));
  const supplied = JSON.parse(secondRequest.input.at(-1).content);
  assert(supplied.eligibleCards.every(card => card.id !== 0), "carta usada deve sair do ciclo até esgotar o baralho");
  await control.getByRole("button", { name: "PERFEITO", exact: true }).click();
  await poll(async () => (await (await fetch(base + "/api/post-demo")).json()).postDemo.rounds.at(-1).rating === "perfect", "avaliação privada");
  const count = (await state()).postDemo.totalRounds;
  await new Promise(resolve => setTimeout(resolve, 1300)); assert.equal((await state()).postDemo.totalRounds, count);
  // The compact handle stays at the top right even after scrolling the parameters.
  await control.setViewportSize({ width: 1280, height: 720 });
  await control.locator("#post-demo-parameters").evaluate(element => { element.scrollTop = element.scrollHeight; });
  const retract = control.getByRole("button", { name: "Recolher parâmetros", exact: true });
  const handle = await retract.boundingBox(); assert(handle && handle.x > 1200 && handle.y >= 60 && handle.y < 100 && handle.width <= 32 && handle.height <= 32);
  await retract.click();
  assert.equal(await control.locator("#post-demo-parameters").count(), 0); assert.equal(await control.getByRole("navigation").count(), 0);
  const expand = control.getByRole("button", { name: "Mostrar parâmetros", exact: true }), collapsedHandle = await expand.boundingBox();
  assert.equal(Math.round(collapsedHandle.x + collapsedHandle.width), 1268);
  assert.equal(Math.round(collapsedHandle.y), 12); assert(collapsedHandle.width <= 32 && collapsedHandle.height <= 32);
  await poll(async () => (await (await fetch(base + "/api/controller-settings?scope=post-demo-panel")).json()).settings.collapsed === true, "painel recolhido salvo");
  await control.reload(); await control.getByRole("button", { name: "Mostrar parâmetros", exact: true }).click();
  await control.locator("#post-demo-parameters").waitFor();
  assert.equal((await state()).postDemo.active, false); assert.equal((await state()).postDemo.totalRounds, count);
  await control.setViewportSize({ width: 1600, height: 1000 });
  await command("resume");
  await projection.waitForFunction(() => document.querySelector('[aria-label="Fala da ilha futura"] p')?.getAttribute("data-typing") === "false");
  await projection.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth));
  await projection.screenshot({ path: path.join(output, "public-island.png") });
  await control.screenshot({ path: path.join(output, "private-island.png") });
  await post("/api/operator", { command: "/stopall" });
  const stoppedAt = (await state()).postDemo.totalRounds;
  await projection.reload(); await control.reload();
  await new Promise(resolve => setTimeout(resolve, 1400));
  assert.equal((await state()).postDemo.active, false); assert.equal((await state()).postDemo.totalRounds, stoppedAt);
  const beforeReset = await state(), configBeforeReset = await privateConfig();
  await fs.writeFile(fixture, JSON.stringify({ principalText: JSON.stringify(reply(0)) }));
  await control.getByRole("button", { name: "RESET", exact: true }).click();
  await poll(async () => { const next = (await state()).postDemo; return next.startedAt !== beforeReset.postDemo.startedAt && next.totalRounds === 1; }, "RESET reinicia na primeira carta");
  await command("pause");
  const afterReset = await state(); assert.equal(afterReset.reliability.sessionId, beforeReset.reliability.sessionId);
  assert.equal(afterReset.audienceWarmup.manualMode, beforeReset.audienceWarmup.manualMode);
  assert.deepEqual(await privateConfig(), configBeforeReset); assert.equal(afterReset.postDemo.rounds[0].card.id, 0);
  assert.notEqual(afterReset.postDemo.rounds[0].id, beforeReset.postDemo.rounds[0].id);
  await post("/api/show-session", { action: "new" });
  await new Promise(resolve => setTimeout(resolve, 500));
  const reset = (await state()).postDemo;
  assert.equal(reset.startedAt, null); assert.equal(reset.rounds.length, 0); assert.equal((await privateConfig()).cardHoldMs, 1000); assert.equal((await privateConfig()).personality.sarcasm, 34);
  assert(publicActions.every(action => ["ack", "ready"].includes(action)), "projeção não pode emitir comandos privados");
  assert.deepEqual(errors, []);
  await operator.close();
  console.log(JSON.stringify({ ok: true, liveModel: false, output, checks: ["tab starts autonomous selection", "future continuation/own parameters without audience/session details in provider input", "public cards/typing without names", "private independent timing/personality/model/font, no global mirroring either way", "automatic second card and no repetition", "private rating", "pause", "right-edge handle works after scrolling and reload without advancing", "STOP ALL/reload", "RESET restarts cards without changing settings/session/manual mode", "new show stays idle and keeps speed", "public/private boundary"] }, null, 2));
} catch (error) {
  await projection?.screenshot({ path: path.join(output, "failure-public.png") }).catch(() => {});
  await control?.screenshot({ path: path.join(output, "failure-control.png") }).catch(() => {});
  console.log("Evidence:", output); throw error;
} finally {
  await browser?.close();
  if (server.exitCode === null) { server.kill("SIGTERM"); await new Promise(resolve => server.once("exit", resolve)); }
  await fs.writeFile(path.join(output, "server.log"), log);
}
