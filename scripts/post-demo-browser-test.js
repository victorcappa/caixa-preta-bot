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
const reply = cardId => ({ cardId, text: cardId === 0 ? "A mala azul que Alice mencionou poderia ser a primeira margem desta ilha. Os espelhos ainda não sabem quem devolver." : "Bob e Clara poderiam habitar uma oficina de máquinas e memórias. A continuação ainda procura a sua margem.", question: "Quem teria o direito de continuar existindo nessa cópia?", sourcePages: [3, 5, 12], memoryIds: [], audienceNames: cardId === 0 ? ["Alice"] : ["Bob", "Clara"] });
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
const command = async (action, data = {}) => post("/api/post-demo", { action, ...data, sessionId: (await state()).reliability.sessionId });
try {
  await poll(async () => { try { return (await fetch(base + "/api/health?skipOptional=1")).ok; } catch { return false; } }, "ready");
  await post("/api/show-session", { action: "new" });
  await post("/api/operator", { command: "/memory Alice mencionou uma mala azul." });
  await post("/api/robot-sound", { settings: { typingIntervalMs: 5, typingPauseMs: 0, messageGapMs: 0 } });
  await command("config", { cardHoldMs: 10000 });
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
  assert.equal(request.tools, undefined);
  const input = JSON.stringify(request.input);
  for (const expected of ["Alice", "Bob", "Clara", "mala azul", "página 12", "Mcluhan", "SARCASMO", "EXPRESSÃO COMPARTILHADA"]) assert(input.includes(expected), `acervo ausente: ${expected}`);
  assert(!input.includes("TEAM_SENTINEL"));
  assert.equal(await projection.getByRole("button").count(), 0);
  assert.equal(await projection.getByRole("textbox").count(), 0);
  for (const name of ["Alice", "Bob", "Clara"]) assert.equal(await projection.getByLabel("Habitantes possíveis da ilha").getByText(name, { exact: true }).count(), 1);
  const first = (await state()).postDemo.rounds[0];
  assert.equal(first.card.id, 0);
  assert(!JSON.stringify(first).includes("trace") && !JSON.stringify(first).includes("rating"));
  const operator = await context.newPage();
  await operator.goto(base + "/operator", { waitUntil: "domcontentloaded" });
  await operator.getByRole("slider", { name: "Intervalo entre cartas do pós-demo", exact: true }).fill("1000");
  await operator.getByRole("navigation", { name: "Controllers cênicos" }).getByRole("link", { name: "pós-demo", exact: true }).click();
  await poll(async () => (await state()).postDemo.config.cardHoldMs === 1000, "ritmo salvo pelo Operator");
  await fs.writeFile(fixture, JSON.stringify({ principalText: JSON.stringify(reply(1)) }));
  await command("resume");
  await projection.getByText(reply(0).question, { exact: false }).waitFor();
  await poll(async () => (await state()).postDemo.totalRounds === 2, "segunda carta automática após digitação e intervalo");
  await command("pause");
  assert.equal((await state()).postDemo.rounds.at(-1).card.id, 1);
  const secondRequest = JSON.parse(await fs.readFile(fixture + ".request.json", "utf8"));
  const supplied = JSON.parse(secondRequest.input.at(-1).content);
  assert(supplied.eligibleCards.every(card => card.id !== 0), "carta usada deve sair do ciclo até esgotar o baralho");
  await control.getByRole("button", { name: "PERFEITO", exact: true }).click();
  await poll(async () => (await (await fetch(base + "/api/post-demo")).json()).postDemo.rounds.at(-1).rating === "perfect", "avaliação privada");
  const count = (await state()).postDemo.totalRounds;
  await new Promise(resolve => setTimeout(resolve, 1300)); assert.equal((await state()).postDemo.totalRounds, count);
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
  await post("/api/show-session", { action: "new" });
  await new Promise(resolve => setTimeout(resolve, 500));
  const reset = (await state()).postDemo;
  assert.equal(reset.startedAt, null); assert.equal(reset.rounds.length, 0); assert.equal(reset.config.cardHoldMs, 1000);
  assert(publicActions.every(action => ["ack", "ready"].includes(action)), "projeção não pode emitir comandos privados");
  assert.deepEqual(errors, []);
  await operator.close();
  console.log(JSON.stringify({ ok: true, liveModel: false, output, checks: ["tab starts autonomous selection", "full continuation/audience/session/global parameters in provider input", "public cards/typing/names", "Operator speed", "automatic second card and no repetition", "private rating", "pause", "STOP ALL/reload", "new show stays idle and keeps speed", "public/private boundary"] }, null, 2));
} catch (error) {
  await projection?.screenshot({ path: path.join(output, "failure-public.png") }).catch(() => {});
  await control?.screenshot({ path: path.join(output, "failure-control.png") }).catch(() => {});
  console.log("Evidence:", output); throw error;
} finally {
  await browser?.close();
  if (server.exitCode === null) { server.kill("SIGTERM"); await new Promise(resolve => server.once("exit", resolve)); }
  await fs.writeFile(path.join(output, "server.log"), log);
}
