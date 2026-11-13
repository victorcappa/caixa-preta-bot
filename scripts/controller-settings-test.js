import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createSettingsSaveQueue } from "../lib/settingsSaveQueue.js";
import { readControllerSettings, saveControllerSettings } from "../lib/controllerSettings.js";

const root = process.cwd(), child = process.argv[2] === "--child";
const directory = child ? process.argv[3] : fs.mkdtempSync(path.join(os.tmpdir(), "caixa-controller-settings-"));
process.env.CAIXA_PRETA_SHOW_RUNTIME_DIR = path.join(directory, "runtime");
if (child) {
  assert.deepEqual(readControllerSettings("model-3d"), { preset: "high", removeBackground: true });
  assert.deepEqual(readControllerSettings("scene-zero-video"), { file: "future.mp4", loop: true, transitionMs: 9100 });
  assert.deepEqual(readControllerSettings("live-training-header"), { collapsed: true });
  assert.deepEqual(readControllerSettings("post-demo-panel"), { collapsed: false });
  process.exit(0);
}
saveControllerSettings("model-3d", { preset: "high", confirmed: true, image: "PRIVATE_UPLOAD" });
saveControllerSettings("scene-zero-video", { file: "future.mp4", transitionMs: 9100 });
saveControllerSettings("model-3d", { removeBackground: true });
saveControllerSettings("scene-zero-video", { loop: true });
saveControllerSettings("live-training-header", { collapsed: true });
saveControllerSettings("post-demo-panel", { collapsed: false });
assert.throws(() => saveControllerSettings("../secret", {}));
const file = path.join(directory, "runtime/controller-settings.json");
assert.equal(fs.statSync(file).mode & 0o777, 0o600);
assert(!fs.readFileSync(file, "utf8").includes("PRIVATE_UPLOAD"));
assert(!fs.readFileSync(file, "utf8").includes("confirmed"));
const restarted = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--child", directory], { encoding: "utf8" });
assert.equal(restarted.status, 0, restarted.stderr);
let release, requests = [], active = 0;
const queue = createSettingsSaveQueue({ save: async patch => { assert.equal(++active, 1); requests.push(patch); if (requests.length === 1) await new Promise(resolve => { release = resolve; }); active--; } });
queue.enqueue({ volume: .2 }); const first = queue.flush(); queue.enqueue({ loop: true }); queue.enqueue({ volume: .7 }); release();
await first; await queue.flush();
assert.deepEqual(requests, [{ volume: .2 }, { loop: true, volume: .7 }]);
let fail = true, last;
const retry = createSettingsSaveQueue({ save: async patch => { if (fail) throw Error("offline"); last = patch; } });
retry.enqueue({ volume: .2 }); assert.equal((await retry.flush()).ok, false);
retry.enqueue({ volume: .9, loop: true }); fail = false; assert((await retry.flush()).ok); assert.deepEqual(last, { volume: .9, loop: true });
fs.mkdirSync(path.join(directory, "data")); fs.symlinkSync(path.join(root, "assets"), path.join(directory, "assets")); process.chdir(directory);
try {
  const { saveForcaGSamplerItemSettings, readForcaGSamplerConfig } = await import("../lib/forca-g-sampler/config.js");
  const item = readForcaGSamplerConfig().sections.gLoc[0]; assert(item);
  saveForcaGSamplerItemSettings(item.id, { loop: !item.loop, volume: .37 });
  const restored = readForcaGSamplerConfig().sections.gLoc.find(entry => entry.id === item.id);
  assert.equal(restored.volume, .37); assert.equal(restored.loop, !item.loop);
} finally { process.chdir(root); }
console.log("CONTROLLER SETTINGS PASS: independent scopes, cold process, private atomic file, no consent/uploads, serialized edits, last-value retry and per-sample volume/loop persistence");
