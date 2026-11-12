import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPointCloudPhotoWatch } from "../lib/post-demo/pointCloudPhotoWatch.js";
import { latestAudiencePhoto } from "../lib/post-demo/pointCloudEngine.js";

function clock(initial = 100000) {
  let time = initial, sequence = 0;
  const tasks = new Map();
  return {
    now: () => time, tasks,
    schedule: (callback, delay) => { const id = ++sequence; tasks.set(id, { at: time + delay, callback }); return id; },
    unschedule: id => tasks.delete(id),
    async advance(ms) {
      const end = time + ms;
      for (;;) {
        const next = [...tasks.entries()].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        tasks.delete(next[0]); time = next[1].at; await next[1].callback();
      }
      time = end;
    },
    fire() {
      const next = [...tasks.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      assert(next); tasks.delete(next[0]); time = next[1].at; return next[1].callback();
    }
  };
}
const photo = (name = "a.jpg", at = 10000, extra = {}) => ({ name, modifiedAt: at, changedAt: at, size: 100, inode: 1, ...extra });
function fixture(options = {}) {
  const timer = clock(options.now), calls = [];
  const value = { sessionId: "session-a", emergency: false, hasPostDemoWindow: true,
    postDemo: { startedAt: new Date(1000).toISOString(), active: true, totalRounds: 8,
      pointCloud: { status: "ready", sourceName: "a.jpg", startedAt: new Date(50000).toISOString() } } };
  let latest = photo(), selectionError = null, busy = false, startError = false, selected = 0;
  const watch = createPointCloudPhotoWatch({ getState: () => value,
    selectPhoto: async () => { selected++; if (selectionError) throw selectionError; return latest; },
    start: () => {
      if (busy) return { busy: true };
      calls.push(latest); value.postDemo.pointCloud = { status: "failed", sourceName: latest.name, startedAt: new Date(timer.now()).toISOString() };
      if (startError) throw Error("conversion failed");
      return { started: true, finished: Promise.resolve() };
    }, ...timer, pollMs: 1500, settleMs: 1000, ...options });
  return { watch, timer, value, calls, setPhoto: next => { latest = next; }, setError: next => { selectionError = next; },
    setBusy: next => { busy = next; }, failStart: () => { startError = true; }, selections: () => selected };
}

// The initial conversion stays intact; only stable, newly saved metadata triggers a job.
{
  const f = fixture(); f.watch.startWatching(); f.watch.startWatching(); assert.equal(f.timer.tasks.size, 1);
  await f.timer.advance(0); assert.equal(f.calls.length, 0);
  f.setPhoto(photo("b.PNG", 60000)); await f.timer.advance(1500); assert.equal(f.calls.length, 0);
  f.setPhoto(photo("b.PNG", 60000, { size: 101 })); await f.timer.advance(1500); assert.equal(f.calls.length, 0);
  await f.timer.advance(1500); assert.equal(f.calls.length, 1);
  await f.timer.advance(6000); assert.equal(f.calls.length, 1, "a failed photo must not loop");
  f.setPhoto(photo("b.PNG", 60000, { size: 101, inode: 2 })); await f.timer.advance(3000); assert.equal(f.calls.length, 2, "atomic replacement is detected even with identical times/size");
  assert.equal(f.value.postDemo.totalRounds, 8); assert.equal(f.value.postDemo.active, true); f.watch.stop();
}
// A file arriving during conversion remains pending; concurrent manual requests win.
{
  const f = fixture(); f.watch.startWatching(); await f.timer.advance(0);
  f.value.postDemo.pointCloud.status = "generating"; f.setPhoto(photo("b.jpg", 60000));
  await f.timer.advance(4500); assert.equal(f.calls.length, 0);
  f.value.postDemo.pointCloud.status = "ready"; f.setBusy(true); await f.timer.advance(1500); assert.equal(f.calls.length, 0);
  f.setBusy(false); await f.timer.advance(1500); assert.equal(f.calls.length, 1); f.watch.stop();
}
// Empty folders and transient stat errors keep polling; an unstable file gets a new settling window.
{
  const f = fixture(); f.setError(Error("NO_AUDIENCE_PHOTO")); f.watch.startWatching(); await f.timer.advance(3000);
  assert.equal(f.calls.length, 0); assert.equal(f.timer.tasks.size, 1);
  f.setError(null); f.setPhoto(photo("b.jpg", 60000)); await f.timer.advance(1500);
  f.setError(Error("EACCES")); await f.timer.advance(1500); f.setError(null);
  f.failStart();
  await f.timer.advance(1500); assert.equal(f.calls.length, 0); await f.timer.advance(1500); assert.equal(f.calls.length, 1);
  await f.timer.advance(6000); assert.equal(f.calls.length, 1, "start errors must not retry the same saved photo forever"); f.watch.stop();
}
// Explicit stops/emergency/recovery cannot resurrect a pending saved image after rearming.
for (const reason of ["stop-all", "interrupted", "recovery", "reset", "emergency", "explicit-stop"]) {
  const f = fixture(); f.watch.startWatching(); await f.timer.advance(0);
  f.setPhoto(photo("b.jpg", f.timer.now())); await f.timer.advance(1500);
  if (reason === "emergency") f.value.emergency = true;
  else if (reason === "explicit-stop") f.watch.stop();
  else f.value.postDemo.pauseReason = reason;
  await f.timer.advance(1500); assert.equal(f.calls.length, 0); assert.equal(f.timer.tasks.size, 0);
  assert.equal(f.watch.startWatching(), reason === "explicit-stop");
  f.value.emergency = false; f.value.postDemo.pauseReason = null; f.watch.startWatching();
  await f.timer.advance(3000); assert.equal(f.calls.length, 0, `${reason}: a cancelled candidate returned`);
  f.setPhoto(photo("c.jpg", f.timer.now() + 1)); await f.timer.advance(3000); assert.equal(f.calls.length, 1); f.watch.stop();
}
// Watch scope: registration has a short grace, leaving stops, and reentry can discover a newer file.
{
  const f = fixture(); f.value.hasPostDemoWindow = false; f.watch.startWatching();
  await f.timer.advance(4500); assert.equal(f.selections(), 0); assert.equal(f.timer.tasks.size, 1);
  f.value.hasPostDemoWindow = true; await f.timer.advance(1500); assert.equal(f.selections(), 1);
  f.value.hasPostDemoWindow = false; await f.timer.advance(1500); assert.equal(f.timer.tasks.size, 0);
  f.setPhoto(photo("b.jpg", 60000)); f.value.hasPostDemoWindow = true; f.watch.startWatching();
  await f.timer.advance(1500); assert.equal(f.calls.length, 1); f.watch.stop();
  const idle = fixture(); idle.value.postDemo.startedAt = null; assert.equal(idle.watch.startWatching(), false);
  const absent = fixture(); absent.value.hasPostDemoWindow = false; absent.watch.startWatching();
  await absent.timer.advance(6000); assert.equal(absent.timer.tasks.size, 0); assert.equal(absent.selections(), 0);
}
// Selection may complete after STOP ALL or a session change; no late callback may publish a job.
for (const interruptedBy of ["session", "emergency", "stop"]) {
  let resolve;
  const deferred = new Promise(done => { resolve = done; });
  const f = fixture({ selectPhoto: () => deferred }); f.watch.startWatching(); const pending = f.timer.fire();
  if (interruptedBy === "session") f.value.sessionId = "session-b";
  else if (interruptedBy === "emergency") f.value.emergency = true;
  else f.watch.stop();
  resolve(photo("b.jpg", 60000)); await pending;
  assert.equal(f.calls.length, 0); assert.equal(f.timer.tasks.size, 0);
  if (interruptedBy !== "session") {
    f.value.emergency = false; f.watch.startWatching(); await f.timer.advance(3000);
    assert.equal(f.calls.length, 0, "an image selected only after cancellation must stay suppressed on rearm"); f.watch.stop();
  }
}
// Real filesystem, same process/module: added and overwritten files are observed without a restart.
{
  const original = process.cwd(), directory = await fs.mkdtemp(path.join(os.tmpdir(), "caixa-cloud-watch-unit-"));
  try {
    const folder = path.join(directory, "assets/publico"); await fs.mkdir(folder, { recursive: true }); process.chdir(directory);
    const f = fixture();
    // Keep timer time aligned with filesystem clocks, while advancing waits deterministically.
    const timer = clock(Date.now()), seen = [], jobs = [];
    let latest;
    f.value.postDemo.pointCloud = { status: "idle", sourceName: null, startedAt: null };
    const watch = createPointCloudPhotoWatch({ getState: () => f.value, ...timer,
      selectPhoto: async () => { latest = await latestAudiencePhoto(); return latest; },
      start: () => {
        const selected = latest, finished = fs.readFile(selected.file, "utf8").then(bytes => seen.push({ name: selected.name, bytes }));
        jobs.push(finished); return { started: true, finished };
      } });
    watch.startWatching(); await timer.advance(0);
    const a = path.join(folder, "a.jpg"), b = path.join(folder, "b.PNG");
    await fs.writeFile(a, "first image"); await fs.utimes(a, timer.now() / 1000, timer.now() / 1000);
    await timer.advance(3000); await Promise.all(jobs); assert.equal(seen.length, 1);
    await fs.writeFile(b, "second image"); await fs.utimes(b, timer.now() / 1000, timer.now() / 1000);
    await timer.advance(3000); await Promise.all(jobs); assert.equal(seen.length, 2);
    const sameTimes = await fs.stat(b); await fs.writeFile(b, "second image replaced with more bytes"); await fs.utimes(b, sameTimes.atime, sameTimes.mtime);
    await timer.advance(3000); await Promise.all(jobs);
    assert.deepEqual(seen, [{ name: "a.jpg", bytes: "first image" }, { name: "b.PNG", bytes: "second image" },
      { name: "b.PNG", bytes: "second image replaced with more bytes" }], "new and overwritten files must provide fresh bytes even when mtime is preserved");
    watch.stop();
  } finally { process.chdir(original); await fs.rm(directory, { recursive: true, force: true }); }
}
console.log("POINT CLOUD WATCH PASS: fresh files/overwrite, stable saves, initial deduplication, busy/pending, failures, scopes, STOP/emergency and late-session rejection");
