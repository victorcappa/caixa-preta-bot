import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mockFile = process.env.CAIXA_PRETA_OPENAI_AUDIT_MOCK;
if (mockFile) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input?.url || input);
    if (!url.startsWith("https://api.openai.com/")) return realFetch(input, options);
    const mode = (await fs.readFile(mockFile, "utf8")).trim();
    const signal = options.signal || input?.signal;
    if (mode === "timeout") {
      return new Promise((_, reject) => {
        const abort = () => reject(new DOMException("Aborted", "AbortError"));
        if (signal?.aborted) abort();
        else signal?.addEventListener("abort", abort, { once: true });
      });
    }
    if (mode === "connection") throw new TypeError("Simulated offline connection");
    if (/^http-/.test(mode)) {
      return new Response(JSON.stringify({ error: { message: "Audit simulated HTTP error", type: "audit_error", code: "audit_error" } }), {
        status: Number(mode.slice(5)), headers: { "content-type": "application/json" }
      });
    }
    const text = mode === "empty" ? "" : mode === "invalid" ? '{"text":"unfinished",'
      : mode === "invalid-type" ? '{"text":{"debug":"internal"}}'
        : JSON.stringify({ text: "AUDIT MOCK SUCCESS", events: [], salience: [] });
    return new Response(JSON.stringify({
      id: "resp_audit", object: "response", status: "completed",
      output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text, annotations: [] }] }]
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
} else {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "caixa-openai-failure-audit-"));
  const fixture = path.join(directory, "mode");
  const base = "http://127.0.0.1:3000";
  let server;
  let log = "";
  const results = [];
  const post = async (route, body) => {
    const response = await fetch(`${base}${route}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    let occupied = false;
    try { await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) }); occupied = true; } catch {}
    assert.equal(occupied, false, "stop the audit server first; never replace an existing listener");
    await fs.writeFile(fixture, "success");
    server = spawn(process.execPath, ["scripts/show-launcher.js"], {
      env: { ...process.env, OPENAI_API_KEY: "audit-only-not-a-real-key", OPENAI_SHOW_TIMEOUT_MS: "1000",
        CAIXA_PRETA_SHOW_RUNTIME_DIR: directory, CAIXA_PRETA_OPENAI_AUDIT_MOCK: fixture,
        NODE_OPTIONS: `--import=${JSON.stringify(fileURLToPath(import.meta.url))}` },
      stdio: ["ignore", "pipe", "pipe"]
    });
    server.stdout.on("data", (chunk) => { log += chunk; });
    server.stderr.on("data", (chunk) => { log += chunk; });
    const deadline = Date.now() + 30000;
    let ready = false;
    while (Date.now() < deadline && !ready) {
      try { ready = (await fetch(`${base}/api/health?skipOptional=1`)).ok; } catch {}
      if (!ready) await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert(ready, log);
    for (const mode of ["success", "http-401", "http-429", "http-500", "timeout", "connection", "empty", "invalid", "invalid-type", "success"]) {
      await fs.writeFile(fixture, mode);
      await post("/api/operator", { command: "/reset" });
      const started = Date.now();
      const response = await post("/api/chat", { message: "auditoria local" });
      const result = { mode, status: response.status, ms: Date.now() - started,
        fallback: Boolean(response.body.fallback?.active), text: response.body.message?.content || response.body.message };
      results.push(result);
      assert.equal(response.status, 200, JSON.stringify(result));
      assert.equal(result.fallback, mode !== "success", JSON.stringify(result));
      assert(result.ms < 4000, "failure must release the turn promptly");
      assert.doesNotMatch(String(result.text), /unfinished|internal|\[object Object\]/);
    }
    await fs.writeFile(fixture, "invalid");
    await post("/api/operator", { command: "/reset" });
    const participant = await post("/api/scene-zero", { action: "set-stage", stage: "participant" });
    assert.equal(participant.status, 200, "invalid/offline IA must not block participant selection");
    assert.equal(participant.body.sceneZero.participantSelection.status, "awaiting_invite");
    results.push({ mode: "participant-invalid-copy", status: participant.status, localSequenceStarted: true });
    console.log("OpenAI failure audit: HTTP 401/429/500, timeout, connection, empty, malformed, invalid type and recovery passed");
  } finally {
    if (server && server.exitCode === null) {
      const exited = new Promise((resolve) => server.once("exit", resolve));
      server.kill("SIGTERM");
      await exited;
    }
    const output = process.env.CAIXA_PRETA_AUDIT_OUTPUT || "artifacts/bot-audit-2026-10-14";
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, "openai-failures.json"), JSON.stringify(results, null, 2));
    await fs.writeFile(path.join(output, "openai-failures-server.log"), log);
    await fs.rm(directory, { recursive: true, force: true });
  }
}
