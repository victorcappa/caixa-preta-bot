import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { decodePointCloud } from "./pointCloudFormat.js";

const toolchain = () => process.env.CAIXA_PRETA_POINT_CLOUD_TOOLCHAIN || path.join(process.cwd(), ".runtime/point-cloud/toolchain");
const sessionRoot = sessionId => path.join(process.env.CAIXA_PRETA_SHOW_RUNTIME_DIR || path.join(process.cwd(), ".runtime/show"), "point-clouds", createHash("sha256").update(sessionId).digest("hex"));
export function pointCloudFile(sessionId, id) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw Error("POINT_CLOUD_INVALID_ID");
  return path.join(sessionRoot(sessionId), id, "points.bin");
}
export async function latestAudiencePhoto() {
  const directory = path.join(process.cwd(), "assets/publico");
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(error => { if (error.code === "ENOENT") return []; throw error; });
  const files = await Promise.all(entries.filter(entry => entry.isFile() && /\.(jpe?g|png)$/i.test(entry.name)).map(async entry => {
    const file = path.join(directory, entry.name), stat = await fs.stat(file);
    return { file, name: entry.name, modifiedAt: stat.mtimeMs };
  }));
  files.sort((a, b) => b.modifiedAt - a.modifiedAt || a.name.localeCompare(b.name));
  if (!files[0]) throw Error("NO_AUDIENCE_PHOTO");
  return files[0];
}
export async function convertAudiencePhoto({ sessionId, id, photo, signal, onProgress }) {
  const root = toolchain(), binary = process.env.CAIXA_PRETA_POINT_CLOUD_CONVERTER || path.join(root, "convert");
  const model = path.join(root, "DepthAnythingV2SmallF16.mlmodelc"), prepared = path.join(root, "prepared.json");
  await Promise.all([fs.access(binary, constants.X_OK), fs.access(path.join(model, "coremldata.bin")), fs.access(prepared)]).catch(() => { throw Error("POINT_CLOUD_NOT_PREPARED"); });
  const manifest = JSON.parse(await fs.readFile(prepared, "utf8"));
  const sourceHash = createHash("sha256").update(await fs.readFile(path.join(process.cwd(), "scripts/post-demo-point-cloud.swift"))).digest("hex");
  if (manifest.sourceHash !== sourceHash) throw Error("POINT_CLOUD_NOT_PREPARED");
  signal.throwIfAborted();
  const output = pointCloudFile(sessionId, id), directory = path.dirname(output), input = path.join(directory, "input-photo" + path.extname(photo.file).toLowerCase());
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  let source;
  try {
    source = await fs.open(photo.file, constants.O_RDONLY | constants.O_NOFOLLOW);
    if (!(await source.stat()).isFile()) throw Error("UNREADABLE_IMAGE");
    await fs.writeFile(input, await source.readFile(), { mode: 0o600 });
    await source.close(); source = null; signal.throwIfAborted();
    await new Promise((resolve, reject) => {
      const child = spawn(binary, [model, input, output], { stdio: ["ignore", "pipe", "pipe"] });
      let remaining = "", failure, done = false, killTimer;
      const stop = () => { child.kill("SIGTERM"); killTimer ||= setTimeout(() => child.kill("SIGKILL"), 1500); };
      signal.addEventListener("abort", stop, { once: true }); if (signal.aborted) stop();
      const timeout = setTimeout(() => { failure = "POINT_CLOUD_TIMEOUT"; stop(); }, 120000);
      child.stdout.on("data", data => {
        remaining += data.toString(); if (remaining.length > 65536) { failure = "POINT_CLOUD_INVALID"; stop(); return; }
        let newline;
        while ((newline = remaining.indexOf("\n")) >= 0) {
          const line = remaining.slice(0, newline); remaining = remaining.slice(newline + 1);
          try { const event = JSON.parse(line); if (Number.isFinite(event.progress)) onProgress(Math.max(10, Math.min(95, event.progress)), event.phase); if (event.error) failure = event.error; if (event.done) done = true; } catch {}
        }
      });
      child.stderr.resume();
      const cleanup = () => { clearTimeout(timeout); clearTimeout(killTimer); signal.removeEventListener("abort", stop); };
      child.once("error", error => { cleanup(); reject(error); });
      child.once("close", code => { cleanup(); if (signal.aborted) reject(new DOMException("Aborted", "AbortError")); else if (code !== 0 || failure || !done) reject(Error(failure || "CONVERSION_FAILED")); else resolve(); });
    });
    signal.throwIfAborted();
    const data = await fs.readFile(output), decoded = decodePointCloud(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    await fs.chmod(output, 0o600); return { pointCount: decoded.count };
  } catch (error) { await fs.rm(output, { force: true }); throw error; }
  finally { if (source) await source.close(); await fs.rm(input, { force: true }); }
}
export async function discardPointCloud(sessionId, id) { await fs.rm(path.dirname(pointCloudFile(sessionId, id)), { recursive: true, force: true }); }
