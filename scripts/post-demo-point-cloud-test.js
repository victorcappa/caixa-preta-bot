import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPointCloudState, createPointCloudController, publicPointCloud } from "../lib/post-demo/pointCloudState.js";
import { latestAudiencePhoto } from "../lib/post-demo/pointCloudEngine.js";
import { decodePointCloud } from "../lib/post-demo/pointCloudFormat.js";

const root = process.cwd(), fixture = await fs.mkdtemp(path.join(os.tmpdir(), "caixa-cloud-unit-"));
await fs.mkdir(path.join(fixture, "assets/publico"), { recursive: true }); process.chdir(fixture);
try {
  const folder = path.join(fixture, "assets/publico");
  await assert.rejects(latestAudiencePhoto, /NO_AUDIENCE_PHOTO/);
  for (const [name, date] of [["z-older.png", 1000], ["a-newer.JPEG", 2000], ["ignore.txt", 9000]]) {
    await fs.writeFile(path.join(folder, name), "fixture"); await fs.utimes(path.join(folder, name), date, date);
  }
  assert.equal((await latestAudiencePhoto()).name, "a-newer.JPEG");
  await fs.utimes(path.join(folder, "z-older.png"), 3000, 3000); assert.equal((await latestAudiencePhoto()).name, "z-older.png");
  let session = "session-a", post = { pointCloud: createPointCloudState(), totalRounds: 8, status: "presenting", active: true }, resolve, fail;
  const discarded = [], events = [];
  const actor = createPointCloudController({ get: () => post, sessionId: () => session, emit: event => events.push(event), selectPhoto: latestAudiencePhoto,
    convert: async ({ onProgress }) => { onProgress(40, "depth"); return new Promise((done, reject) => { resolve = done; fail = reject; }); }, discard: async (...args) => discarded.push(args) });
  const waitForWorker = async () => { for (let n = 0; n < 100 && !resolve; n++) await new Promise(done => setTimeout(done, 5)); assert(resolve); };
  const first = actor.start(); await waitForWorker(); assert(actor.start().busy);
  assert.equal(post.pointCloud.status, "generating"); assert.equal(post.status, "presenting"); assert.equal(post.totalRounds, 8);
  resolve({ pointCount: 100 }); await first.finished;
  const published = post.pointCloud.current; assert.equal(post.pointCloud.status, "ready");
  const publicRef = publicPointCloud(post.pointCloud, session); assert.deepEqual(Object.keys(publicRef).sort(), ["id", "url"]);
  assert(!JSON.stringify(publicRef).includes(".png")); assert.equal(publicPointCloud(post.pointCloud, "other-session"), null);
  resolve = null; const failed = actor.start(); await waitForWorker(); fail(Error("UNREADABLE_IMAGE")); await failed.finished;
  assert.equal(post.pointCloud.current.id, published.id); assert.equal(post.pointCloud.status, "failed"); assert.match(post.pointCloud.error, /não pode ser lida/);
  resolve = null; const delayed = actor.start(); await waitForWorker(); const lateResolve = resolve, oldId = post.pointCloud.jobId;
  actor.cancel(); session = "session-b"; post = { pointCloud: createPointCloudState() };
  lateResolve({ pointCount: 100 }); await delayed.finished;
  assert.equal(post.pointCloud.current, null); assert(discarded.some(([sid, id]) => sid === "session-a" && id === oldId));
  resolve = null; const changedSession = actor.start(); await waitForWorker(); const delayedWithoutCancel = resolve;
  session = "session-c"; post = { pointCloud: createPointCloudState() }; delayedWithoutCancel({ pointCount: 100 }); await changedSession.finished;
  assert.equal(post.pointCloud.current, null, "o ID da sessão deve ser validado mesmo sem um cancelamento cooperativo");
  resolve = null; const fresh = actor.start(); await waitForWorker(); assert.equal(fresh.busy, undefined); resolve({ pointCount: 123 }); await fresh.finished;
  assert.equal(post.pointCloud.current.sessionId, "session-c");
  assert(events.every(event => JSON.stringify(event) === '{"type":"post-demo:point-cloud"}'));
  assert.throws(() => decodePointCloud(new ArrayBuffer(16)));
  const denseCount = 1024 * 1024, denseBytes = new ArrayBuffer(16 + denseCount * 15), denseView = new DataView(denseBytes);
  denseView.setUint32(0, 0x43505043, false); denseView.setUint32(4, 1, true); denseView.setUint32(8, denseCount, true); denseView.setUint32(12, 15, true);
  for (let index = 0; index < denseCount; index++) denseView.setFloat32(16 + index * 15 + 8, 1, true);
  assert.equal(decodePointCloud(denseBytes).count, denseCount, "aceitar a malha 1024² completa, acima do limite antigo");
  denseView.setUint32(8, denseCount + 1, true); assert.throws(() => decodePointCloud(denseBytes), /POINT_CLOUD_INVALID/);
  console.log("POINT CLOUD UNIT PASS: latest mtime on every click, empty folder, independent background job, busy guard, failure keeps previous, reference-only public state and stale-session rejection");
} finally { process.chdir(root); }
