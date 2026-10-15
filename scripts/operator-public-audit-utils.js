import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export async function prepareOperatorAudit() {
  if (process.env.CAIXA_PRETA_OPERATOR_AUDIT_ROOT) return process.env.CAIXA_PRETA_OPERATOR_AUDIT_ROOT;
  const root = process.cwd();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "caixa-operator-audit-"));
  for (const item of ["app", "components", "lib", "prompts", "data", "knowledge", "public", "scripts",
    "package.json", "package-lock.json", "next.config.js", "jsconfig.json", "eslint.config.mjs"]) {
    await fs.cp(path.join(root, item), path.join(directory, item), { recursive: true });
  }
  for (const item of ["assets", "node_modules"]) await fs.symlink(path.join(root, item), path.join(directory, item));
  console.log(`Preparing isolated production audit: ${directory}`);
  const build = spawn(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
    cwd: directory, env: { ...process.env, OPENAI_API_KEY: "", NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"]
  });
  let log = "";
  build.stdout.on("data", (chunk) => { log += chunk; });
  build.stderr.on("data", (chunk) => { log += chunk; });
  const code = await new Promise((resolve, reject) => { build.on("exit", resolve); build.on("error", reject); });
  await fs.writeFile(path.join(directory, "audit-build.log"), log);
  if (code !== 0) throw new Error(`Audit build failed:\n${log.slice(-5000)}`);
  return directory;
}
