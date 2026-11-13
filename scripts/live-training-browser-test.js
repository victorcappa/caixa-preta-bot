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
  assert.deepEqual(tabs.slice(-3), ["Treino", "treino-ao-vivo", "pós-demo"]);
  assert.equal(await display.getByRole("textbox").count(), 0);
  assert.equal(await display.getByRole("button").count(), 0);
  const operator = await context.newPage(), tarot = await context.newPage();
  await operator.goto(`${base}/operator`, { waitUntil: "domcontentloaded" });
  await tarot.goto(`${base}/treinamento/controle`, { waitUntil: "domcontentloaded" });
  await tarot.getByRole("button", { name: "10 — Personalidade e contexto", exact: true }).click();
  const panels = [control, operator, tarot];
  const slider = (page, name) => page.getByRole("slider", { name, exact: true });
  async function slide(page, name, value) {
    const input = slider(page, name);
    await input.fill(String(value));
    await poll(async () => (await Promise.all(panels.map(panel => slider(panel, name).inputValue()))).every(current => current === String(value)), `${name} espelhado nas três telas`);
  }
  await slider(control, "Humor").waitFor();
  await slide(control, "SARCASMO", 82);
  await slide(operator, "CURIOSIDADE", 67);
  await slide(tarot, "Humor", 23);
  await slide(control, "Linguagem poética", 81);
  await slide(operator, "Rigor analítico", 37);
  // Independent keys edited in different clients must survive concurrent writes.
  await Promise.all([slider(control, "Provocação").fill("29"), slider(tarot, "Crítica social").fill("73")]);
  await poll(async () => (await Promise.all(panels.flatMap(panel => [slider(panel, "Provocação").inputValue(), slider(panel, "Crítica social").inputValue()]))).every((value, index) => value === (index % 2 ? "73" : "29")), "edições simultâneas preservadas");
  const settings = await (await fetch(`${base}/api/operator-public`)).json();
  assert.deepEqual(Object.keys(settings).sort(), ["personality", "profile", "revision", "sessionId"]);
  assert.equal((await state()).tarot.profile, undefined, "perfil privado não deve entrar na projeção");
  await control.reload();
  await poll(async () => await slider(control, "Linguagem poética").inputValue() === "81", "perfil compartilhado após reload");
  await operator.close(); await tarot.close();
  const draft = control.getByLabel("Mensagem");
  const panel = control.locator("#live-training-parameters");
  const expandedHistory = await control.getByRole("log").boundingBox();
  const projectionNavigations = [];
  control.on("request", request => {
    if (request.method() === "POST" && request.url().endsWith("/api/projection")) projectionNavigations.push(request.postData());
  });
  await draft.fill("Rascunho preservado ao recolher.");
  await panel.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await control.getByRole("button", { name: "Recolher cabeçalho", exact: true }).click();
  assert.equal(await panel.isVisible(), true);
  assert.equal(await slider(control, "Linguagem poética").inputValue(), "81");
  assert.equal(await control.getByRole("navigation").count(), 0);
  assert.equal(await control.getByRole("heading", { name: "treino-ao-vivo", exact: true }).count(), 0);
  assert.equal(await control.getByRole("slider", { name: "Volume geral", exact: true }).count(), 0);
  assert.equal(await draft.inputValue(), "Rascunho preservado ao recolher.");
  const collapsedHistory = await control.getByRole("log").boundingBox();
  assert.equal(collapsedHistory.width, expandedHistory.width);
  assert(collapsedHistory.height > expandedHistory.height);
  const expand = control.getByRole("button", { name: "Mostrar cabeçalho", exact: true });
  const handle = await expand.boundingBox();
  assert.equal(handle.y, 12); assert.equal(handle.width, 28); assert.equal(handle.height, 28);
  await control.screenshot({ path: path.join(output, "collapsed-controls.png") });
  await poll(async () => (await (await fetch(base + "/api/controller-settings?scope=live-training-header")).json()).settings.collapsed === true, "cabeçalho recolhido salvo");
  assert.equal((await (await fetch(base + "/api/controller-settings?scope=post-demo-panel")).json()).settings.collapsed, false);
  assert.deepEqual(projectionNavigations, [], "recolher não deve navegar a projeção");
  await control.reload();
  await poll(async () => await expand.isVisible(), "cabeçalho recolhido após reload");
  assert.equal(await panel.isVisible(), true);
  await expand.click();
  assert.equal(await panel.isVisible(), true);
  assert.equal(await slider(control, "Linguagem poética").inputValue(), "81");
  assert.equal(await control.getByRole("navigation").count(), 1);
  assert.equal(await control.getByRole("heading", { name: "treino-ao-vivo", exact: true }).count(), 1);
  await draft.fill("Como Morel atravessa a memória desta peça?");
  const firstResponse = control.waitForResponse(response => response.url().endsWith("/api/live-training") && response.request().method() === "POST");
  await draft.press("Enter");
  const accepted = await firstResponse;
  assert(accepted.ok(), JSON.stringify(await accepted.json()));
  await display.locator('[data-role="user"]').filter({ hasText: "Como Morel" }).waitFor();
  await display.locator('[data-role="assistant"] [data-typing="true"]').waitFor();
  const typing = await control.locator('[data-role="assistant"] [data-typing="true"]').elementHandle();
  assert(typing);
  await control.getByRole("button", { name: "Recolher cabeçalho", exact: true }).click();
  assert.equal(await typing.evaluate(element => element.isConnected), true, "recolher deve preservar a fala montada");
  await expand.click();
  assert.equal(await typing.evaluate(element => element.isConnected), true, "reabrir deve preservar a fala montada");
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
  assert(prompt.includes("SARCASMO: 82%") && prompt.includes("CURIOSIDADE: 67%") && prompt.includes("Humor: 23%") && prompt.includes("Linguagem poética: 81%"));
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
  // Inspect what actually crossed the provider boundary, beyond the permanent summary.
  await post("/api/show-session", { action: "new" });
  await fs.writeFile(fixture, JSON.stringify({ chunks: ["Um arquivo em desenvolvimento."], delay: 50 }));
  await post("/api/live-training", { action: "send", sessionId: (await state()).reliability.sessionId,
    text: "O que o rascunho propõe na cena 9, com a bicicleta e o milagre?", requestId: "source-coverage" });
  await poll(async () => (await state()).liveTraining.status === "idle", "source-coverage reply");
  const sourceRequest = JSON.parse(await fs.readFile(`${fixture}.request.json`, "utf8"));
  const recoveredText = sourceRequest.input.find(message => message.content?.startsWith("ACERVO RECUPERADO"))?.content || "";
  assert(recoveredText.includes("Texto caixa preta.pdf") && recoveredText.includes("página 32") && recoveredText.includes("bicicleta"));
  assert(JSON.stringify(sourceRequest.input).includes("Mala 2 → Mala 1 → Mala 3"));
  assert.deepEqual(publicWrites, []);
  assert.deepEqual(privateReads, []);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, liveModel: false, physicalMicrophone: false, output,
    checks: ["tab beside Treino", "retractable header keeps sidebar, saves independent preference, preserves draft/typing without projection navigation", "bidirectional Operator/Tarot/live parameter mirroring and concurrent edits", "shared parameters reach provider prompt", "public conversation and typing", "private one-click feedback/upsert", "PDF page 32 at actual provider boundary and current suitcase precedence", "three public alternatives", "reload/polling without SSE", "failure/retry without duplicate", "STOP ALL", "public/private boundary"] }, null, 2));
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
