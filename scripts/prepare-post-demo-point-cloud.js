import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

if (process.platform !== "darwin") throw Error("O conversor Core ML precisa de macOS.");
const source = process.env.CAIXA_PRETA_POINT_CLOUD_MODEL_SOURCE || "/Users/VictorCappa/.codex/.chatgpt-projects/g-p-69fcd3b88a0c81919f366bf84809f25c/output/plateia-point-cloud/.cache/DepthAnythingV2SmallF16.mlmodelc";
const root = process.env.CAIXA_PRETA_POINT_CLOUD_TOOLCHAIN || path.join(process.cwd(), ".runtime/point-cloud/toolchain");
const model = path.join(root, "DepthAnythingV2SmallF16.mlmodelc"), script = path.join(process.cwd(), "scripts/post-demo-point-cloud.swift");
await fs.access(path.join(source, "coremldata.bin")); await fs.mkdir(root, { recursive: true, mode: 0o700 });
await fs.cp(source, model, { recursive: true });
execFileSync("xcrun", ["swiftc", "-O", "-module-cache-path", path.join(root, "swift-cache"), script, "-o", path.join(root, "convert")], { stdio: "inherit" });
await fs.chmod(path.join(root, "convert"), 0o700);
const warmImage = path.join(root, "warmup.png"), warmPoints = path.join(root, "warmup.bin"), warmStarted = Date.now();
try {
  // Prepare the Core ML execution plan before the show, without using any audience photo.
  await fs.writeFile(warmImage, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"), { mode: 0o600 });
  execFileSync(path.join(root, "convert"), [model, warmImage, warmPoints], { stdio: "inherit", timeout: 120000 });
} finally { await fs.rm(warmImage, { force: true }); await fs.rm(warmPoints, { force: true }); }
const hash = createHash("sha256").update(await fs.readFile(script)).digest("hex");
await fs.writeFile(path.join(root, "prepared.json"), JSON.stringify({ model: "DepthAnythingV2SmallF16", sourceHash: hash, preparedAt: new Date().toISOString(), warmupMs: Date.now() - warmStarted }, null, 2), { mode: 0o600 });
console.log("POINT CLOUD READY: modelo local e conversor preparados; conversões não usam rede, Python, FFmpeg ou downloads.");
