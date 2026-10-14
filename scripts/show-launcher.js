const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = process.cwd();
const port = 3000;
const runtimeDirectory = process.env.CAIXA_PRETA_SHOW_RUNTIME_DIR
  ? path.resolve(process.env.CAIXA_PRETA_SHOW_RUNTIME_DIR)
  : path.join(root, ".runtime", "show");

function fail(message) {
  console.error(`[Caixa Preta] ${message}`);
  process.exit(1);
}

function requireFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.once("listening", () => server.close(resolve));
    server.listen(port, "0.0.0.0");
  });
}

async function waitUntilReady(child) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health?skipOptional=1`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("health check não ficou pronto em 30 segundos");
}

async function main() {
  if (!fs.existsSync(path.join(root, ".next", "BUILD_ID"))) {
    fail("build de produção ausente. Rode npm run show:prepare antes de abrir a sala.");
  }

  fs.mkdirSync(runtimeDirectory, { recursive: true });
  fs.accessSync(runtimeDirectory, fs.constants.R_OK | fs.constants.W_OK);

  try {
    await requireFreePort();
  } catch (error) {
    fail(error.code === "EADDRINUSE"
      ? "a porta 3000 já está em uso; nenhum processo foi encerrado automaticamente."
      : `não foi possível reservar a porta 3000 (${error.code || error.message}).`);
  }

  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "--hostname", "0.0.0.0", "--port", `${port}`], {
    cwd: root,
    env: process.env,
    stdio: "inherit"
  });

  const stop = (signal) => {
    if (child.exitCode === null) child.kill(signal);
  };
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));

  try {
    await waitUntilReady(child);
    const pidFile = path.join(runtimeDirectory, "server.pid");
    fs.writeFileSync(pidFile, `${child.pid}\n`, { mode: 0o600 });
    console.log(`[Caixa Preta] espetáculo pronto em http://localhost:${port}/operator`);

    child.once("exit", (code, signal) => {
      try {
        if (fs.readFileSync(pidFile, "utf8").trim() === `${child.pid}`) fs.unlinkSync(pidFile);
      } catch {}
      console.log(`[Caixa Preta] servidor encerrado (${signal || code || 0}).`);
      process.exit(code || 0);
    });
  } catch (error) {
    stop("SIGTERM");
    fail(error.message);
  }
}

main().catch((error) => fail(error.message));
