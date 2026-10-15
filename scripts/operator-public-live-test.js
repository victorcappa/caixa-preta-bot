import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { prepareOperatorAudit } from "./operator-public-audit-utils.js";

assert(process.argv.includes("--live"), "Use --live: performs two real, text-only OpenAI generations");
const auditRoot = await prepareOperatorAudit();
// Only load the existing local credential into this process and its isolated child. Never print it.
try { process.loadEnvFile(path.resolve(".env.local")); } catch {}
assert(process.env.OPENAI_API_KEY, "Existing OPENAI_API_KEY required");
const base = "http://127.0.0.1:3312";
const output = path.resolve(process.env.CAIXA_PRETA_AUDIT_OUTPUT || "artifacts/operator-public-2026-10-15");
await fs.mkdir(output, { recursive: true });
let occupied = false;
try { await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) }); occupied = true; } catch {}
assert(!occupied, "Dedicated live audit port is occupied");
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "3312", "--hostname", "127.0.0.1"], {
  cwd: auditRoot, env: { ...process.env, OPENAI_SHOW_TIMEOUT_MS: "15000", CAIXA_PRETA_OPERATOR_MOCK: "",
    CAIXA_PRETA_SHOW_RUNTIME_DIR: path.join(auditRoot, "runtime-live") }, stdio: ["ignore", "pipe", "pipe"]
});
let log = "";
server.stdout.on("data", (chunk) => { log += chunk; });
server.stderr.on("data", (chunk) => { log += chunk; });
async function post(body) {
  const response = await fetch(`${base}/api/operator-public`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  assert(response.ok);
  return response.json();
}
async function poll(predicate, label, timeout = 25000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await predicate()) return; await new Promise((resolve) => setTimeout(resolve, 50)); }
  throw new Error(`Timeout ${label}`);
}
let browser;
const results = [];
try {
  await poll(async () => { try { return (await fetch(`${base}/api/health?skipOptional=1`)).ok; } catch { return false; } }, "server");
  browser = await chromium.launch({ headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  const projection = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const operator = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await projection.goto(base);
  await operator.goto(`${base}/cena-0-controller`);
  await post({ action: "patch", visible: true });
  await operator.getByRole("button", { name: "ABRIR CONVERSA", exact: true }).click();
  await projection.getByRole("log").waitFor();
  for (const sarcasm of [10, 90]) {
    await post({ action: "patch", personality: { sarcasm, verbosity: 20 } });
    await projection.evaluate(() => {
      window.__deltas = [];
      window.__observer?.disconnect();
      const history = document.querySelector('[aria-label="Operator público"] [role="log"]');
      window.__observer = new MutationObserver(() => {
        const text = history.querySelector('article:last-child p')?.textContent || "";
        if (text && text !== window.__deltas.at(-1)?.text) window.__deltas.push({ text, at: Date.now() });
      });
      window.__observer.observe(history, { childList: true, subtree: true, characterData: true });
    });
    await operator.getByLabel("OPERADOR >", { exact: false }).fill("Estamos no meio de uma peça. Diga em uma frase como está a sua disposição para colaborar comigo, considerando a cena real atual. Não pesquise.");
    const started = Date.now();
    const finished = operator.waitForResponse((response) => response.url().endsWith("/api/operator-public") && response.request().postDataJSON()?.action === "send");
    await operator.getByRole("button", { name: "ENVIAR", exact: true }).click();
    const response = await finished;
    const body = await response.json();
    assert.equal(body.generationError, null, "A fallback is not proof of live generation");
    const snapshots = await projection.evaluate(() => window.__deltas);
    const message = body.operatorPublic.messages.at(-1);
    assert.equal(message.status, "complete");
    assert(snapshots.some(({ text }) => text.replace(/_$/, "").trim().length > 0 && text.replace(/_$/, "").trim().length < message.content.trim().length), "Browser must display a partial model response");
    await projection.getByRole("log").getByText(message.content, { exact: true }).last().waitFor();
    results.push({ sarcasm, model: (await (await fetch(`${base}/api/state`)).json()).model,
      durationMs: Date.now() - started, message: message.content, browserUpdates: snapshots.length,
      firstPartialAtMs: snapshots.find(({ text }) => text.replace(/_$/, "").trim().length > 0)?.at - started,
      realProvider: true });
  }
  await projection.screenshot({ path: path.join(output, "openai-live-projection.png") });
  await fs.writeFile(path.join(output, "openai-live.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await fs.writeFile(path.join(output, "openai-live-server.log"), log);
}
