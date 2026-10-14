import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const baseUrl = "http://127.0.0.1:3000";
const runtimeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "caixa-preta-show-scenario-"));
let server = null;
let serverLog = "";

function portIsFree() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: 3000 });
    socket.once("connect", () => { socket.destroy(); resolve(false); });
    socket.once("error", () => resolve(true));
  });
}

async function json(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: options.body ? { "Content-Type": "application/json", ...options.headers } : options.headers
  });
  const body = await response.json();
  return { response, body };
}

async function waitForHealth() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const { response } = await json("/api/health?skipOptional=1");
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`servidor não ficou pronto\n${serverLog.slice(-4000)}`);
}

async function startServer() {
  serverLog = "";
  server = spawn(process.execPath, ["scripts/show-launcher.js"], {
    cwd: root,
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
      OPENAI_SHOW_TIMEOUT_MS: "1000",
      CAIXA_PRETA_SHOW_RUNTIME_DIR: runtimeDirectory,
      CAIXA_PRETA_RELIABILITY_TESTS: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  server.stdout.on("data", (chunk) => { serverLog += chunk; });
  server.stderr.on("data", (chunk) => { serverLog += chunk; });
  await waitForHealth();
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  const exited = new Promise((resolve) => server.once("exit", resolve));
  server.kill("SIGTERM");
  await Promise.race([
    exited,
    new Promise((_, reject) => setTimeout(() => reject(new Error("servidor não encerrou")), 8000))
  ]);
  server = null;
}

async function post(pathname, body) {
  return json(pathname, { method: "POST", body: JSON.stringify(body) });
}

assert.equal(await portIsFree(), true, "porta 3000 deve estar livre; o teste nunca encerra processos existentes");

try {
  await startServer();
  await post("/api/operator", { command: "/reset" });
  await post("/api/operator", { command: "/memory reliability-restart-marker" });
  const staged = await post("/api/scene-zero", { action: "set-stage", stage: "glitch", detail: "ensaio de retomada" });
  assert.equal(staged.response.ok, true, staged.body.error || "não mudou de etapa");
  await new Promise((resolve) => setTimeout(resolve, 300));
  await stopServer();

  await startServer();
  const earlyProjection = await post("/api/projection", {
    action: "register",
    projectionWindowId: "recovery-guard-probe",
    path: "/"
  });
  assert.equal(earlyProjection.response.ok, true);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const interrupted = await json("/api/show-session");
  assert.equal(interrupted.body.recoverable, true, "restart deve oferecer retomada explícita");
  assert.equal(interrupted.body.snapshot.summary.scene, "glitch");

  const browser = await chromium.launch({ headless: true });
  try {
    const operator = await browser.newPage();
    await operator.goto(`${baseUrl}/operator`, { waitUntil: "domcontentloaded" });
    await operator.getByRole("button", { name: "RETOMAR APRESENTAÇÃO" }).click();
    await operator.getByText("APRESENTAÇÃO INTERROMPIDA ENCONTRADA").waitFor({ state: "detached" });

    const recovered = await json("/api/state");
    assert.equal(recovered.body.sceneZero.stage, "glitch");
    assert.ok(recovered.body.memories.some((memory) => memory.content.includes("reliability-restart-marker")));

    const publicError = await browser.newPage();
    await publicError.goto(`${baseUrl}/reliability-test/public-error`, { waitUntil: "domcontentloaded" });
    await publicError.getByText("SINAL INTERROMPIDO").waitFor();
    await publicError.waitForTimeout(150);
    const errorState = await json("/api/state");
    assert.equal(errorState.body.reliability.lastPublicError.message, "PUBLIC_ERROR_BOUNDARY_TEST");
    await operator.getByRole("button", { name: "ATIVAR MODO EMERGÊNCIA" }).waitFor();
  } finally {
    await browser.close();
  }

  await post("/api/operator", { command: "/memory discard-this-old-session" });
  const oldSessionId = (await json("/api/state")).body.reliability.sessionId;
  await new Promise((resolve) => setTimeout(resolve, 300));
  await stopServer();

  await startServer();
  assert.equal((await json("/api/show-session")).body.recoverable, true);
  const fresh = await post("/api/show-session", { action: "new" });
  assert.equal(fresh.response.ok, true);
  assert.notEqual(fresh.body.state.reliability.sessionId, oldSessionId);
  assert.equal(fresh.body.state.memories.some((memory) => memory.content.includes("discard-this-old-session")), false);

  const chat = await post("/api/chat", { message: "continuamos mesmo sem internet" });
  assert.equal(chat.response.ok, true, chat.body.error || "chat offline bloqueou a peça");
  assert.equal(chat.body.fallback.active, true);
  const chatState = await json("/api/state");
  assert.equal(chatState.body.conversation.at(-1).source, "fallback-local");

  const emergencyOn = await post("/api/reliability", { action: "emergency-on", reason: "scenario-test" });
  assert.equal(emergencyOn.body.reliability.emergencyMode.active, true);
  const localSequence = await post("/api/operator", { command: "/memory emergency-manual-sequence" });
  assert.equal(localSequence.response.ok, true, "comando local deve funcionar em emergência");
  const blockedInstagram = await post("/api/operator", { command: "/instagram open" });
  assert.equal(blockedInstagram.response.status, 409, "serviço externo deve ficar bloqueado");
  const emergencyChat = await post("/api/chat", { message: "avance manualmente" });
  assert.equal(emergencyChat.response.ok, true);
  assert.equal(emergencyChat.body.fallback.key, "emergency");
  const health = await json("/api/health?skipOptional=1");
  assert.equal(health.body.ok, true);
  assert.equal(health.body.core.emergencyMode.active, true);
  assert.equal(health.body.optional.externalRequests.status, "blocked");
  const emergencyOff = await post("/api/reliability", { action: "emergency-off" });
  assert.equal(emergencyOff.body.reliability.emergencyMode.active, false);

  console.log("SHOW RELIABILITY SCENARIOS A-D OK");
} finally {
  await stopServer().catch(() => {});
  await fs.rm(runtimeDirectory, { recursive: true, force: true });
}
