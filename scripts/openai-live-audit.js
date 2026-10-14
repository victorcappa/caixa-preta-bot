import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Opt-in: one real generation against a dedicated audit server with valid key.
if (!process.argv.includes("--live")) throw new Error("Use --live on a dedicated audit session.");
const base = process.env.CAIXA_PRETA_URL || "http://localhost:3000";
const output = process.env.CAIXA_PRETA_AUDIT_OUTPUT || "artifacts/bot-audit-2026-10-14";
async function post(route, body) {
  const response = await fetch(`${base}${route}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
  });
  return { status: response.status, body: await response.json() };
}
const initialHealth = await (await fetch(`${base}/api/health?skipOptional=1`)).json();
assert.equal(initialHealth.optional.openAI.configured, true, "the dedicated server must have a real key configured");
await post("/api/operator", { command: "/reset" });
await post("/api/operator", { command: "/autonomy research off" });
await post("/api/operator", { command: "/memory Palavra de controle deste ensaio: azul-cobalto-731." });
const started = Date.now();
const response = await post("/api/chat", {
  message: "Faça uma fala curta da Caixa Preta, com seu sarcasmo habitual, incluindo a palavra de controle registrada pelo operador. Não pesquise nem inicie jogos."
});
const health = await (await fetch(`${base}/api/health?skipOptional=1`)).json();
const state = await (await fetch(`${base}/api/state`)).json();
const result = { status: response.status, ms: Date.now() - started, model: state.model,
  source: response.body.message?.source, text: response.body.message?.content,
  fallback: Boolean(response.body.fallback?.active), contextMarkerPresent: /azul[- ]cobalto[- ]731/i.test(response.body.message?.content || ""),
  openAIHealth: health.optional.openAI.status };
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, "openai-app-live.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
assert.equal(response.status, 200);
assert.equal(result.fallback, false, "a local fallback is not proof of real provider generation");
assert.equal(result.source, "openai");
assert.equal(result.contextMarkerPresent, true, "the model must use the operator's context, not just the last user request");
