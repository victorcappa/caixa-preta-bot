import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { prepareOperatorAudit } from "./operator-public-audit-utils.js";

const root = await prepareOperatorAudit();
const base = "http://127.0.0.1:3313";
const output = path.resolve("artifacts/microphone-background-2026-10-15");
await fs.mkdir(output, { recursive: true });
let occupied = false;
try { await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) }); occupied = true; } catch {}
assert(!occupied, "Audit port 3313 occupied; no existing process will be stopped");
let serverLog = "";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "3313", "--hostname", "127.0.0.1"], {
  cwd: root, env: { ...process.env, OPENAI_API_KEY: "", CAIXA_PRETA_SHOW_RUNTIME_DIR: path.join(root, "microphone-runtime") },
  stdio: ["ignore", "pipe", "pipe"]
});
server.stdout.on("data", (chunk) => { serverLog += chunk; });
server.stderr.on("data", (chunk) => { serverLog += chunk; });
try {
  let ready = false;
  const deadline = Date.now() + 30000;
  while (!ready && Date.now() < deadline) {
    try { ready = (await fetch(`${base}/api/health?skipOptional=1`)).ok; } catch {}
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready, serverLog);
  for (const background of ["0", "1"]) {
    const child = spawn(process.execPath, ["--no-warnings", "scripts/audience-sound-check-browser-test.js"], {
      cwd: root, env: { ...process.env, CAIXA_PRETA_URL: base, CAIXA_PRETA_BACKGROUND_MIC: background },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let log = "";
    child.stdout.on("data", (chunk) => { log += chunk; });
    child.stderr.on("data", (chunk) => { log += chunk; });
    const code = await new Promise((resolve) => child.once("exit", resolve));
    await fs.writeFile(path.join(output, background === "1" ? "background.log" : "foreground.log"), log);
    assert.equal(code, 0, log);
    console.log(log.trim());
  }
  await fs.copyFile(path.join(root, "audit-build.log"), path.join(output, "build.log")).catch(() => {});
} finally {
  server.kill("SIGTERM");
  await fs.writeFile(path.join(output, "server.log"), serverLog);
}
