import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { prepareOperatorAudit } from "./operator-public-audit-utils.js";

// A production source copy, disposable training data, mock provider and dedicated port.
const auditRoot = await prepareOperatorAudit();
await fs.writeFile(path.join(auditRoot, "data/training-examples.json"), "[]");
const output = await fs.mkdtemp(path.join(os.tmpdir(), "caixa-live-training-browser-"));
const base = "http://127.0.0.1:3325";
const fixture = path.join(output, "provider.json");
await fs.writeFile(fixture, JSON.stringify({ chunks: ["A memória ", "da peça ", "também responde."], delay: 180 }));
let occupied = false;
try { await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(700) }); occupied = true; } catch {}
assert(!occupied, "A porta 3325 já está ocupada; nenhum processo existente será encerrado.");
const server = spawn(process.execPath, ["--import", fileURLToPath(new URL("./operator-public-mock.js", import.meta.url)),
  "node_modules/next/dist/bin/next", "start", "--port", "3325", "--hostname", "127.0.0.1"], {
  cwd: auditRoot, env: { ...process.env, OPENAI_API_KEY: "audit-only", OPENAI_BASE_URL: "https://api.openai.com/v1", OPENAI_SHOW_TIMEOUT_MS: "7000",
    CAIXA_PRETA_SHOW_RUNTIME_DIR: path.join(output, "runtime"), CAIXA_PRETA_OPERATOR_MOCK: fixture }, stdio: ["ignore", "pipe", "pipe"]
});
let log = "", browser, display, control;
server.stdout.on("data", chunk => { log += chunk; });
server.stderr.on("data", chunk => { log += chunk; });
async function poll(predicate, label, timeout = 20000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (server.exitCode !== null) throw new Error(log.slice(-2500));
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 60));
  }
  throw new Error(`Timeout: ${label}`);
}
const state = async () => (await fetch(`${base}/api/state`)).json();
async function post(route, body) {
  const response = await fetch(base + route, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const value = await response.json();
  assert(response.ok, JSON.stringify(value));
  return value;
}
try {
  await poll(async () => { try { return (await fetch(`${base}/api/health?skipOptional=1`)).ok; } catch { return false; } }, "server ready");
  await post("/api/show-session", { action: "new" });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  display = await context.newPage(); control = await context.newPage();
  const errors = [], publicWrites = [], privateReads = [];
  for (const page of [display, control]) page.on("pageerror", error => errors.push(error.message));
  display.on("request", request => {
    if (request.url().includes("/api/live-training")) privateReads.push(request.url());
    if (request.method() !== "GET" && request.url().includes("/api/live-training")) publicWrites.push(request.url());
  });
  await display.goto(`${base}/treino-ao-vivo?projectionWindow=live-training-test`, { waitUntil: "domcontentloaded" });
  await control.goto(`${base}/treino-ao-vivo/controle`, { waitUntil: "domcontentloaded" });
  const nav = control.getByRole("navigation", { name: "Controllers cênicos" });
  const tabs = await nav.getByRole("link").allTextContents();
  assert.deepEqual(tabs.slice(-2), ["Treino", "treino-ao-vivo"]);
  assert.equal(await display.getByRole("textbox").count(), 0);
  assert.equal(await display.getByRole("button").count(), 0);
  const draft = control.getByLabel("FALE COM A CAIXA");
  await draft.fill("Como Morel atravessa a memória desta peça?");
  const firstResponse = control.waitForResponse(response => response.url().endsWith("/api/live-training") && response.request().method() === "POST");
  await draft.press("Enter");
  const accepted = await firstResponse;
  assert(accepted.ok(), JSON.stringify(await accepted.json()));
  await display.locator('[data-role="user"]').filter({ hasText: "Como Morel" }).waitFor();
  await display.locator('[data-role="assistant"] [data-typing="true"]').waitFor();
  await display.getByText("A memória da peça também responde.", { exact: true }).waitFor();
  await control.getByText("A memória da peça também responde.", { exact: true }).waitFor();
  await control.getByRole("button", { name: "PERFEITO", exact: true }).click();
  await poll(async () => (await control.getByRole("button", { name: "PERFEITO", exact: true }).getAttribute("aria-pressed")) === "true", "perfect feedback saved");
  await control.getByRole("button", { name: "QUASE", exact: true }).click();
  await poll(async () => (await (await fetch(`${base}/api/live-training`)).json()).liveTraining.messages.some(message => message.rating === "almost"), "one-click almost rating");
  const examples = JSON.parse(await fs.readFile(path.join(auditRoot, "data/training-examples.json"), "utf8"));
  assert.equal(examples.filter(example => example.source === "live-training").length, 1);
  assert.equal(examples.find(example => example.source === "live-training").rating, "almost");
  const input = JSON.parse(await fs.readFile(`${fixture}.request.json`, "utf8"));
  const prompt = JSON.stringify(input.input);
  assert(prompt.includes("knowledge/dramaturgy.md") && prompt.includes("Morel") && prompt.includes("ACERVO RECUPERADO"));
  assert.equal(input.tools, undefined, "a conversa não deve executar comandos ou ferramentas");
  await fs.writeFile(fixture, JSON.stringify({ principalText: JSON.stringify({ alternatives: ["O arquivo responde ao corpo.", "A ausência também deixa rastro.", "Uma cópia pede outra lembrança."] }) }));
  await control.getByRole("button", { name: "GERAR ALTERNATIVAS", exact: true }).click();
  await display.getByText("Uma cópia pede outra lembrança.", { exact: true }).waitFor();
  assert.equal(await display.getByText("CAIXA · ALTERNATIVA", { exact: true }).count(), 3);
  assert.equal(await control.getByRole("button", { name: "RUIM", exact: true }).count(), 4);
  const snapshot = await state();
  assert(!JSON.stringify(snapshot.liveTraining).includes('"rating"'));
  assert.equal(snapshot.sceneZero.stage, "idle", "a conversa não pode avançar a dramaturgia");
  await display.screenshot({ path: path.join(output, "public-conversation.png") });
  await control.screenshot({ path: path.join(output, "private-controls.png") });
  await display.route("**/api/events?*", route => route.abort());
  await display.reload();
  await display.getByText("Uma cópia pede outra lembrança.", { exact: true }).waitFor();
  await fs.writeFile(fixture, JSON.stringify({ chunks: ["Mesmo sem SSE, ", "a conversa chega."], delay: 180 }));
  await draft.fill("Continue sem mudar de cena.");
  await control.getByRole("button", { name: "ENVIAR", exact: true }).click();
  await display.getByText("Mesmo sem SSE, a conversa chega.", { exact: true }).waitFor();
  await fs.writeFile(fixture, JSON.stringify({ mode: "failure" }));
  await draft.fill("Uma tentativa com falha.");
  await draft.press("Enter");
  await control.getByRole("alert").waitFor();
  await control.waitForFunction(() => document.getElementById("live-training-message")?.value === "Uma tentativa com falha.");
  assert.equal(await draft.inputValue(), "Uma tentativa com falha.");
  const beforeRetry = (await state()).liveTraining.messages.filter(message => message.role === "user").length;
  await fs.writeFile(fixture, JSON.stringify({ chunks: ["A conversa ", "continua."], delay: 100 }));
  await draft.press("Enter");
  await display.getByText("A conversa continua.", { exact: true }).waitFor();
  assert.equal((await state()).liveTraining.messages.filter(message => message.role === "user").length, beforeRetry, "retry não deve duplicar a mensagem enviada");
  await fs.writeFile(fixture, JSON.stringify({ chunks: ["Uma fala ", "que ainda ", "não terminou."], delay: 700 }));
  const sessionId = (await state()).reliability.sessionId;
  const sending = post("/api/live-training", { action: "send", sessionId, text: "Interrompa esta fala.", requestId: "stop-check" }).catch(() => {});
  await poll(async () => (await state()).liveTraining.status === "generating", "stream before STOP ALL");
  await post("/api/operator", { command: "/stopall" });
  await sending;
  assert.equal((await state()).liveTraining.messages.at(-1).status, "cancelled");
  assert.deepEqual(publicWrites, []);
  assert.deepEqual(privateReads, []);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, liveModel: false, physicalMicrophone: false, output,
    checks: ["tab beside Treino", "public conversation and typing", "private one-click feedback/upsert", "full local corpus context", "three public alternatives", "reload/polling without SSE", "failure/retry without duplicate", "STOP ALL", "public/private boundary"] }, null, 2));
} catch (error) {
  await display?.screenshot({ path: path.join(output, "failure-public.png") }).catch(() => {});
  await control?.screenshot({ path: path.join(output, "failure-control.png") }).catch(() => {});
  console.log("Failure evidence:", output);
  throw error;
} finally {
  await browser?.close();
  if (server.exitCode === null) { server.kill("SIGTERM"); await new Promise(resolve => server.once("exit", resolve)); }
  await fs.writeFile(path.join(output, "server.log"), log);
}
