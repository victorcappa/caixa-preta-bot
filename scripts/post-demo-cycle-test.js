import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { prepareOperatorAudit } from "./operator-public-audit-utils.js";

const combined = process.argv.includes("--combined");
const resumeFrom = process.argv.find(value => value.startsWith("--resume="))?.slice(9);
const live = process.argv.includes("--live"), port = live ? 3330 : 3329, base = `http://127.0.0.1:${port}`;
if (live && !process.env.OPENAI_API_KEY) throw new Error("A consulta real exige a API já configurada.");
const root = await prepareOperatorAudit();
assert.notEqual(path.resolve(root), process.cwd(), "O teste exige uma cópia isolada.");
const output = await fs.mkdtemp(path.join(os.tmpdir(), "caixa-post-demo-cycle-")), fixture = path.join(output, "provider.json");
await fs.writeFile(path.join(root, "data/publico.json"), JSON.stringify([{ name: "publico", nomes: ["Pessoa Aurora", "Pessoa Maré", "Pessoa Horizonte"] }, { name: "equipe", nomes: ["TEAM_SENTINEL"] }]));
for (const file of ["training-examples.json", "style-notes.json"]) await fs.writeFile(path.join(root, "data", file), "[]");
await fs.writeFile(fixture, "{}");
if (resumeFrom) {
  assert(live, "A recuperação pertence ao teste real.");
  await fs.mkdir(path.join(output, "runtime"));
  for (const file of ["current.json", "operator-preferences.json"]) await fs.copyFile(path.join(resumeFrom, "runtime", file), path.join(output, "runtime", file));
}
let occupied = false; try { await fetch(base + "/api/health", { signal: AbortSignal.timeout(500) }); occupied = true; } catch {}
assert(!occupied, `Porta ${port} ocupada; nenhum processo existente será encerrado.`);
const preload = fileURLToPath(new URL("./post-demo-cycle-provider.js", import.meta.url));
const server = spawn(process.execPath, [...(live ? [] : ["--import", preload]), "node_modules/next/dist/bin/next", "start", "--port", String(port), "--hostname", "127.0.0.1"], {
  cwd: root, env: { ...process.env, OPENAI_API_KEY: live ? process.env.OPENAI_API_KEY : "audit-only",
    ...(!live ? { OPENAI_BASE_URL: "https://api.openai.com/v1", CAIXA_PRETA_POST_DEMO_CYCLE_FIXTURE: fixture } : {}),
    CAIXA_PRETA_SHOW_RUNTIME_DIR: path.join(output, "runtime") }, stdio: ["ignore", "pipe", "pipe"]
});
let log = "", browser, projection, heartbeat;
server.stdout.on("data", chunk => { log += chunk; }); server.stderr.on("data", chunk => { log += chunk; });
const errors = [], acknowledgements = [], known = new Map(), checks = [], rounds = [];
async function get(route) { const response = await fetch(base + route); assert(response.ok, route); return response.json(); }
async function post(route, body) {
  const response = await fetch(base + route, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json(); assert(response.ok, JSON.stringify(result)); return result;
}
async function poll(run, label, timeout = 45000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (server.exitCode !== null) throw Error(log.slice(-1500)); const value = await run(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 80)); }
  throw Error(`Timeout: ${label}`);
}
const state = () => get("/api/state"), details = async () => (await get("/api/post-demo")).postDemo;
let sessionId;
const command = (action, data = {}) => post("/api/post-demo", { action, sessionId, ...data });
try {
  await poll(async () => { try { return (await fetch(base + "/api/health?skipOptional=1")).ok; } catch { return false; } }, "servidor");
  await post("/api/show-session", { action: resumeFrom ? "resume" : "new" }); sessionId = (await state()).reliability.sessionId;
  if (!resumeFrom) await post("/api/operator", { command: "/memory DADO FICTÍCIO DE TESTE: Pessoa Aurora guardou uma chave em vez de abrir a mala." });
  await command("config", { config: { typingIntervalMs: 20, typingPauseMs: 0, cardHoldMs: 1000 } });
  const cards = (await get("/api/tarot/catalog")).cards.filter(card => card.imageUrl);
  assert.equal(cards.length, 22);
  const initial = await details();
  for (const round of initial.rounds) { known.set(round.id, round); rounds.push({ number: rounds.length + 1, id: round.id, cardId: round.card.id, card: round.card.name,
    content: round.content, sourcePages: round.trace.sourcePages, usedNames: round.usedNames, memoryIds: round.trace.memoryIds, presentedAt: round.presentedAt, resumed: true }); }
  if (!live) {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    projection = await context.newPage(); projection.on("pageerror", failure => errors.push(failure.message));
    await projection.route("**/api/post-demo", async route => {
      const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
      if (body?.action === "ack") {
        const content = await projection.getByLabel("Fala da ilha futura").innerText(), round = known.get(body.roundId);
        if (!round || content.trim() !== round.content.trim()) errors.push(`ACK antes do texto completo: ${body.roundId}`);
        acknowledgements.push(body.roundId);
      }
      await route.continue();
    });
    await projection.goto(base + (combined ? "/pos-demo/controle" : "/pos-demo?projectionWindow=cycle-test"), { waitUntil: "domcontentloaded" });
    if (combined) {
      await projection.getByRole("button", { name: "Recolher parâmetros", exact: true }).click();
      assert.equal(await projection.getByRole("navigation").count(), 0);
      assert.equal(await projection.getByRole("slider").count(), 0);
      assert.equal(await projection.getByRole("heading", { name: "pós-demo", exact: true }).count(), 0);
    } else {
      const control = await context.newPage(); control.on("pageerror", failure => errors.push(failure.message));
      await control.goto(base + "/pos-demo/controle", { waitUntil: "domcontentloaded" });
    }
  } else {
    // Live-model validation uses the real server's ACK gate; animated display is tested separately above.
    await post("/api/projection", { action: "register", projectionWindowId: "cycle-live-test", path: "/pos-demo" });
    heartbeat = setInterval(() => void post("/api/projection", { action: "heartbeat", projectionWindowId: "cycle-live-test", path: "/pos-demo" }).catch(error => errors.push(error.message)), 4000);
    await command(resumeFrom ? "resume" : "enter");
  }
  for (let number = initial.totalRounds + 1; number <= cards.length; number++) {
    const started = Date.now();
    const round = await poll(async () => {
      const current = await details();
      if (current.status === "failed") throw Error(`Rodada ${number}: ${current.error}`);
      if (current.totalRounds === number) return current.rounds.at(-1);
      assert(current.totalRounds < number, "não pode saltar uma rodada"); return null;
    }, `geração ${number}`);
    known.set(round.id, round);
    assert(round.content.trim().endsWith("?")); assert(round.trace.sourcePages.length); assert(cards.some(card => card.id === round.card.id));
    const previous = rounds.at(-1);
    if (previous) assert(Date.parse(round.createdAt) >= Date.parse(previous.presentedAt) + 990, "o intervalo deve começar após a confirmação da fala anterior");
    const image = await fetch(base + round.card.imageUrl); assert(image.ok && image.headers.get("content-type").startsWith("image/"));
    if (live) await command("ack", { roundId: round.id });
    const presentedAt = await poll(async () => { const current = (await details()).rounds.at(-1); return current?.id === round.id && current.presentedAt; }, `digitação/ACK ${number}`);
    rounds.push({ number, id: round.id, cardId: round.card.id, card: round.card.name, content: round.content, sourcePages: round.trace.sourcePages,
      usedNames: round.usedNames, memoryIds: round.trace.memoryIds, presentedAt, ms: Date.now() - started });
    if (number === cards.length) { assert.equal(new Set(rounds.map(item => item.cardId)).size, 22); checks.push("22 cartas diferentes concluídas sem avanço manual"); }
    console.log(`${live ? "LIVE" : "BROWSER"} ${number}/${cards.length}: ${round.card.name}; fala, pergunta, imagem e ACK completos.`);
    if (combined && number === 10) {
      await projection.getByRole("button", { name: "Mostrar parâmetros", exact: true }).click();
      assert(await projection.getByRole("slider").count() > 0);
      await projection.getByRole("button", { name: "Recolher parâmetros", exact: true }).click();
      assert.equal(await projection.getByRole("slider").count(), 0);
    }
    if (!live && number === 7) {
      await fs.writeFile(fixture, '{"fail":true}');
      await poll(async () => (await details()).status === "failed", "falha do provedor pausa antes da oitava carta");
      assert.equal((await details()).totalRounds, 7);
      await new Promise(resolve => setTimeout(resolve, 1300)); assert.equal((await details()).totalRounds, 7);
      await fs.writeFile(fixture, "{}"); await command("resume");
      checks.push("falha pausa sem pular carta; retomada conclui as cartas restantes");
    }
  }
  await poll(async () => (await details()).status === "completed", "encerramento automático após a 22ª fala e intervalo");
  const completed = await details(); assert.equal(completed.totalRounds, 22); assert.equal(completed.active, false); assert(completed.completedAt);
  await command("resume"); await command("enter"); await new Promise(resolve => setTimeout(resolve, 1400));
  assert.equal((await details()).totalRounds, 22); assert.equal((await details()).status, "completed");
  checks.push("encerra automaticamente após 22 cartas, sem 23ª geração ou reinício de ciclo");
  if (!live) {
    assert(rounds.every(round => acknowledgements.includes(round.id)), "cada rodada precisa de ACK emitido pela projeção");
    assert.equal(await projection.getByRole("button").count(), combined ? 1 : 0);
    const final = completed.rounds.at(-1);
    await projection.reload();
    if (combined) {
      await projection.getByRole("button", { name: "Mostrar parâmetros", exact: true }).waitFor();
      assert.equal(await projection.getByRole("slider").count(), 0); assert.equal(await projection.getByRole("navigation").count(), 0);
      checks.push("mesma tela avança sozinha, painel recolhe/reabre, título removido e preferência persiste após reload");
    }
    await projection.getByText(final.content, { exact: false }).waitFor();
    await projection.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
    await projection.locator("figure").evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished)); });
    await projection.screenshot({ path: path.join(output, "cycle-complete.png") });
    assert.equal((await details()).totalRounds, 22); assert.equal((await details()).status, "completed");
    await post("/api/operator", { command: "/stopall" });
    assert.equal((await details()).status, "completed");
    checks.push("última fala permanece visível após reload; STOP ALL mantém o encerramento");
  }
  assert.deepEqual(errors, []);
  const report = { ok: true, liveModel: live, combinedScreen: combined, resumedRounds: initial.totalRounds, display: live ? "ACK pelo cliente de teste; animação coberta no teste de navegador" : "navegador real com provedor simulado", rounds, checks, output };
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, liveModel: live, rounds: rounds.length, checks, output }, null, 2));
} catch (error) {
  await projection?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  console.log("Evidence:", output); throw error;
} finally {
  clearInterval(heartbeat); await browser?.close();
  if (server.exitCode === null) { const ended = new Promise(resolve => server.once("exit", resolve)); server.kill("SIGTERM"); await ended; }
  await fs.writeFile(path.join(output, "server.log"), log);
}
